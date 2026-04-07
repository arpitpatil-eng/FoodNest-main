const express = require("express");
const crypto = require("crypto");
const oracledb = require("oracledb");
const { getConnection } = require("../config/db");
const { requireAuth } = require("../middleware/auth");
const { createId } = require("../utils/ids");
const { hashPassword, verifyPassword } = require("../utils/passwords");

const router = express.Router();
const allowedRoles = ["student", "cook", "delivery"];

router.post("/signup", async (req, res) => {
  const { name, username, password, role } = req.body;

  if (!name || !username || !password || !role) {
    return res.status(400).json({ message: "All fields required." });
  }

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ message: "Invalid role." });
  }

  let connection;

  try {
    connection = await getConnection();

    const existing = await connection.execute(
      `SELECT id FROM users WHERE username = :username`,
      { username },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Username already exists." });
    }

    const userId = createId("user");
    const passwordHash = hashPassword(password);
    const nestCoins = role === "student" ? 500 : 0;

    await connection.execute(
      `INSERT INTO users (id, name, username, password_hash, role, nest_coins)
       VALUES (:id, :name, :username, :password_hash, :role, :nest_coins)`,
      {
        id: userId,
        name,
        username,
        password_hash: passwordHash,
        role,
        nest_coins: nestCoins
      },
      { autoCommit: true }
    );

    res.status(201).json({
      message: "User registered successfully.",
      user: { id: userId, name, username, role, nestCoins }
    });
  } catch (error) {
    res.status(500).json({ message: "Signup failed.", error: error.message });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT id, name, username, password_hash, role, nest_coins
       FROM users
       WHERE username = :username`,
      { username },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const user = result.rows[0];

    if (!verifyPassword(password, user.PASSWORD_HASH)) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const sessionId = createId("sess");
    const token = crypto.randomBytes(24).toString("hex");

    await connection.execute(
      `INSERT INTO user_sessions (id, user_id, token)
       VALUES (:id, :user_id, :token)`,
      {
        id: sessionId,
        user_id: user.ID,
        token
      },
      { autoCommit: true }
    );

    res.json({
      message: "Login successful.",
      token,
      user: {
        id: user.ID,
        name: user.NAME,
        username: user.USERNAME,
        role: user.ROLE,
        nestCoins: user.NEST_COINS
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed.", error: error.message });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.get("/me", requireAuth, async (req, res) => {
  res.json({
    user: {
      id: req.user.ID || req.user.id,
      name: req.user.NAME || req.user.name,
      username: req.user.USERNAME || req.user.username,
      role: req.user.ROLE || req.user.role,
      nestCoins: req.user.NEST_COINS ?? req.user.nest_coins ?? 0
    }
  });
});

module.exports = router;

