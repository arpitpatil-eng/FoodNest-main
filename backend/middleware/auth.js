const { getConnection } = require("../config/db");
const oracledb = require("oracledb");

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Token required." });
  }

  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT u.id, u.name, u.username, u.role, u.nest_coins
       FROM users u
       JOIN user_sessions s ON s.user_id = u.id
       WHERE s.token = :token`,
      { token },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid token." });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    res.status(500).json({ message: "Auth error.", error: error.message });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

module.exports = { requireAuth };

