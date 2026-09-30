const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");

const file = path.join(__dirname, "users.json");

function loadUsers() {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, "[]");
  }

  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync(file, JSON.stringify(users, null, 2));
}

async function createUser(email, password) {
  const users = loadUsers();

  const exists = users.find(
    user => user.email.toLowerCase() === email.toLowerCase()
  );

  if (exists) {
    throw new Error("هذا البريد مسجل بالفعل");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = {
    id: Date.now().toString(),
    email: email.toLowerCase(),
    passwordHash,
    subscription: false,
    createdAt: new Date().toISOString()
  };

  users.push(user);
  saveUsers(users);

  return user;
}

async function verifyUser(email, password) {
  const users = loadUsers();

  const user = users.find(
    user => user.email.toLowerCase() === email.toLowerCase()
  );

  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) return null;

  return user;
}

module.exports = {
  createUser,
  verifyUser
};
