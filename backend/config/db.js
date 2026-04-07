const oracledb = require("oracledb");

async function getConnection() {
  const user = process.env.DB_USER || "YOUR_USERNAME";
  const password = process.env.DB_PASSWORD || "YOUR_PASSWORD";
  const connectionString = process.env.DB_CONNECTION_STRING || "localhost:1521/XEPDB1";

  return oracledb.getConnection({
    user,
    password,
    connectionString
  });
}

module.exports = { getConnection };

