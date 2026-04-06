const oracledb = require("oracledb");

async function getConnection() {
  return oracledb.getConnection({
    user: "YOUR_USERNAME",
    password: "YOUR_PASSWORD",
    connectionString: "localhost:1521/XEPDB1"
  });
}

module.exports = { getConnection };

