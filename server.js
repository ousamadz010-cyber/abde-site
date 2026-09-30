const express = require("express");
const path = require("path");
const session = require("express-session");

const { createUser, verifyUser } = require("./users");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://ousamadz010-cyber.github.io");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(
  session({
    secret: "my-subscription-site-secret-change-this-later",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

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

    req.session.userId = user.id;
    req.session.email = user.email;

    res.json({
      success: true,
      message: "تم إنشاء الحساب بنجاح",
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

    req.session.userId = user.id;
    req.session.email = user.email;

    res.json({
      success: true,
      message: "تم تسجيل الدخول بنجاح",
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

// المستخدم الحالي
app.get("/api/me", (req, res) => {
  if (!req.session.userId) {
    return res.json({
      loggedIn: false
    });
  }

  res.json({
    loggedIn: true,
    user: {
      id: req.session.userId,
      email: req.session.email
    }
  });
});

// ترقية تجريبية إلى Premium
app.post("/api/test-subscribe", (req, res) => {
  if (!req.session.userId) {
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
    u => u.id === req.session.userId
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
app.get("/api/premium", (req, res) => {
  if (!req.session.userId) {
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
    u => u.id === req.session.userId
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
  req.session.destroy(() => {
    res.json({
      success: true,
      message: "تم تسجيل الخروج"
    });
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`My Subscription Site running on http://127.0.0.1:${PORT}`);
});
