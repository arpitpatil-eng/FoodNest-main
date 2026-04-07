const fs = require("fs");
const path = require("path");
const oracledb = require("oracledb");

const defaultClientLibDir = "C:\\oraclexe\\app\\oracle\\product\\11.2.0\\server\\bin";
const defaultTnsAdminDir = path.join(__dirname, "..", "oracle-network");
let clientInitialized = false;

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function initOracleClientIfNeeded() {
  if (clientInitialized) {
    return;
  }

  const libDir = process.env.ORACLE_CLIENT_LIB_DIR || defaultClientLibDir;
  if (!process.env.TNS_ADMIN && fs.existsSync(defaultTnsAdminDir)) {
    process.env.TNS_ADMIN = defaultTnsAdminDir;
  }
  if (fs.existsSync(libDir)) {
    oracledb.initOracleClient({ libDir });
    clientInitialized = true;
  }
}

loadEnvFile();
initOracleClientIfNeeded();

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
