const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = "https://abde-site.onrender.com/auth/google/callback";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
const JWT_SECRET = process.env.JWT_SECRET;

const { createUser, verifyUser, getUserById, setSubscription, getUserByGoogleId, createGoogleUser } = require("./users");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://ousamadz010-cyber.github.io");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Google OAuth
app.get("/auth/google", (req, res) => {
  const url = googleClient.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    prompt: "select_account"
  });
  res.redirect(url);
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send("Google authorization code missing");

    const { tokens } = await googleClient.getToken(code);
    googleClient.setCredentials(tokens);

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      return res.status(400).send("Google account information is incomplete");
    }

    let user = await getUserByGoogleId(payload.sub);
    if (!user) {
      user = await createGoogleUser(payload.sub, payload.email);
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const frontend = "https://ousamadz010-cyber.github.io/abde-site/account.html";
    res.redirect(frontend + "?token=" + encodeURIComponent(token));
  } catch (error) {
    console.error("Google OAuth error:", error);
    res.status(500).send("Google login failed");
  }
});

// إنشاء حساب
app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "البريد الإلكتروني وكلمة المرور مطلوبان"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل"
      });
    }

    const user = await createUser(email, password);


    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "تم إنشاء الحساب بنجاح",
      token,
      user: {
        id: user.id,
        email: user.email,
        subscription: user.subscription
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// تسجيل الدخول
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "البريد الإلكتروني وكلمة المرور مطلوبان"
      });
    }

    const user = await verifyUser(email, password);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "البريد الإلكتروني أو كلمة المرور غير صحيحة"
      });
    }


    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "تم تسجيل الدخول بنجاح",
      token,
      user: {
        id: user.id,
        email: user.email,
        subscription: user.subscription
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم"
    });
  }
});

function authenticateToken(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ loggedIn: false, message: "يجب تسجيل الدخول" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ loggedIn: false, message: "جلسة الدخول منتهية" });
  }
}

// المستخدم الحالي
app.get("/api/me", authenticateToken, (req, res) => {
  res.json({
    loggedIn: true,
    user: {
      id: req.user.userId,
      email: req.user.email
    }
  });
});

// ترقية تجريبية إلى Premium
app.post("/api/test-subscribe", authenticateToken, async (req, res) => {
  if (!req.user.userId) {
    return res.status(401).json({
      success: false,
      message: "يجب تسجيل الدخول"
    });
  }

  try {
    const user = await setSubscription(req.user.userId, true);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود"
      });
    }

    res.json({
      success: true,
      message: "تم تفعيل Premium تجريبيًا"
    });
  } catch (error) {
    console.error("Subscription error:", error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم"
    });
  }
});

// حماية محتوى Premium
app.get("/api/premium", authenticateToken, async (req, res) => {
  if (!req.user.userId) {
    return res.status(401).json({
      allowed: false,
      message: "يجب تسجيل الدخول"
    });
  }

  try {
    const user = await getUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        allowed: false,
        message: "المستخدم غير موجود"
      });
    }

    if (user.subscription !== true) {
      return res.json({
        allowed: false,
        message: "هذا المحتوى متاح للمشتركين فقط"
      });
    }

    res.json({
      allowed: true
    });
  } catch (error) {
    console.error("Premium error:", error);
    res.status(500).json({
      allowed: false,
      message: "حدث خطأ في الخادم"
    });
  }
});

// تسجيل الخروج
app.post("/logout", (req, res) => {
  res.json({ success: true, message: "تم تسجيل الخروج" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`My Subscription Site running on http://127.0.0.1:${PORT}`);
});
