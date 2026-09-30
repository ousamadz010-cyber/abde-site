const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

const { createUser, verifyUser } = require("./users");

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
app.post("/api/test-subscribe", authenticateToken, (req, res) => {
  if (!req.user.userId) {
    return res.status(401).json({
      success: false,
      message: "يجب تسجيل الدخول"
    });
  }

  const fs = require("fs");
  const usersFile = path.join(__dirname, "users.json");

  if (!fs.existsSync(usersFile)) {
    return res.status(404).json({
      success: false,
      message: "ملف المستخدمين غير موجود"
    });
  }

  const users = JSON.parse(
    fs.readFileSync(usersFile, "utf8")
  );

  const user = users.find(
    u => u.id === req.user.userId
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "المستخدم غير موجود"
    });
  }

  user.subscription = true;

  fs.writeFileSync(
    usersFile,
    JSON.stringify(users, null, 2)
  );

  res.json({
    success: true,
    message: "تم تفعيل Premium تجريبيًا"
  });
});

// حماية محتوى Premium
app.get("/api/premium", authenticateToken, (req, res) => {
  if (!req.user.userId) {
    return res.status(401).json({
      allowed: false,
      message: "يجب تسجيل الدخول"
    });
  }

  const fs = require("fs");
  const usersFile = path.join(__dirname, "users.json");

  if (!fs.existsSync(usersFile)) {
    return res.json({ allowed: false });
  }

  const users = JSON.parse(fs.readFileSync(usersFile, "utf8"));

  const user = users.find(
    u => u.id === req.user.userId
  );

  if (!user || user.subscription !== true) {
    return res.json({
      allowed: false,
      message: "هذا المحتوى متاح للمشتركين فقط"
    });
  }

  res.json({
    allowed: true
  });
});

// تسجيل الخروج
app.post("/logout", (req, res) => {
  res.json({ success: true, message: "تم تسجيل الخروج" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`My Subscription Site running on http://127.0.0.1:${PORT}`);
});
