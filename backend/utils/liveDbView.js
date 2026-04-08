const fs = require("fs");
const path = require("path");
const oracledb = require("oracledb");
const { getConnection } = require("../config/db");

const liveDbDir = path.join(__dirname, "..", "live-db-view");
let refreshChain = Promise.resolve();

function dash(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}

function formatTable(title, columns, rows) {
  const widths = columns.map((column) => column.label.length);

  for (const row of rows) {
    columns.forEach((column, index) => {
      widths[index] = Math.max(widths[index], dash(row[column.key]).length);
    });
  }

  const header = `| ${columns.map((column, index) => column.label.padEnd(widths[index])).join(" | ")} |`;
  const separator = `|-${widths.map((width) => "-".repeat(width)).join("-|-")}-|`;
  const lines = [`TABLE: ${title}`, "", header, separator];

  for (const row of rows) {
    lines.push(`| ${columns.map((column, index) => dash(row[column.key]).padEnd(widths[index])).join(" | ")} |`);
  }

  if (rows.length === 0) {
    lines.push("| (no rows) |");
  }

  return `${lines.join("\n")}\n`;
}

async function writeLiveDbViews() {
  let connection;

  try {
    connection = await getConnection();
    fs.mkdirSync(liveDbDir, { recursive: true });

    const views = [
      {
        file: "hosteller.table",
        title: "HOSTELLER",
        columns: [
          { key: "ID", label: "id" },
          { key: "NAME", label: "name" },
          { key: "USERNAME", label: "username" },
          { key: "COINS", label: "coins" },
          { key: "AGE", label: "age" },
          { key: "PHONE", label: "phone" },
          { key: "COLLEGE", label: "college" },
          { key: "HOSTEL_ADDRESS", label: "hostel_address" },
          { key: "HOSTEL_NAME", label: "hostel_name" },
          { key: "ROOM_NUMBER", label: "room_number" }
        ],
        sql: `SELECT u.id, u.name, u.username, u.nest_coins AS coins, p.age, p.phone,
                     p.college_name AS college, p.hostel_address, p.hostel_name, p.room_number
              FROM users u
              LEFT JOIN user_profiles p ON p.user_id = u.id
              WHERE u.role = 'student'
              ORDER BY u.created_at DESC`
      },
      {
        file: "homecook.table",
        title: "HOMECOOK",
        columns: [
          { key: "ID", label: "id" },
          { key: "NAME", label: "name" },
          { key: "USERNAME", label: "username" },
          { key: "COINS", label: "coins" },
          { key: "AGE", label: "age" },
          { key: "PHONE", label: "phone" },
          { key: "EXPERIENCE_YEARS", label: "experience_years" },
          { key: "CUISINE", label: "cuisine" },
          { key: "AVAILABILITY", label: "availability" }
        ],
        sql: `SELECT u.id, u.name, u.username, u.nest_coins AS coins, p.age, p.phone,
                     p.cook_experience_years AS experience_years, p.cook_cuisine AS cuisine,
                     p.cook_availability AS availability
              FROM users u
              LEFT JOIN user_profiles p ON p.user_id = u.id
              WHERE u.role = 'cook'
              ORDER BY u.created_at DESC`
      },
      {
        file: "delivery_agent.table",
        title: "DELIVERY_AGENT",
        columns: [
          { key: "ID", label: "id" },
          { key: "NAME", label: "name" },
          { key: "USERNAME", label: "username" },
          { key: "COINS", label: "coins" },
          { key: "AGE", label: "age" },
          { key: "PHONE", label: "phone" },
          { key: "CONTACT_PHONE", label: "contact_phone" },
          { key: "ALTERNATE_PHONE", label: "alternate_phone" },
          { key: "VEHICLE", label: "vehicle" },
          { key: "HOURS", label: "hours" },
          { key: "SHIFT", label: "shift" }
        ],
        sql: `SELECT u.id, u.name, u.username, u.nest_coins AS coins, p.age, p.phone,
                     da.phone AS contact_phone, da.alternate_phone, da.vehicle_type AS vehicle,
                     da.available_hours AS hours, da.shift
              FROM users u
              LEFT JOIN user_profiles p ON p.user_id = u.id
              LEFT JOIN delivery_agents da ON da.user_id = u.id
              WHERE u.role = 'delivery'
              ORDER BY u.created_at DESC`
      },
      {
        file: "users.table",
        title: "USERS",
        columns: [
          { key: "ID", label: "id" },
          { key: "NAME", label: "name" },
          { key: "USERNAME", label: "username" },
          { key: "ROLE", label: "role" },
          { key: "NEST_COINS", label: "nest_coins" },
          { key: "CREATED_AT", label: "created_at" }
        ],
        sql: `SELECT id, name, username, role, nest_coins, TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
              FROM users
              ORDER BY created_at DESC`
      },
      {
        file: "user_profiles.table",
        title: "USER_PROFILES",
        columns: [
          { key: "USER_ID", label: "user_id" },
          { key: "AGE", label: "age" },
          { key: "PHONE", label: "phone" },
          { key: "COLLEGE_NAME", label: "college_name" },
          { key: "HOSTEL_NAME", label: "hostel_name" },
          { key: "ROOM_NUMBER", label: "room_number" },
          { key: "COOK_CUISINE", label: "cook_cuisine" },
          { key: "DELIVERY_VEHICLE", label: "delivery_vehicle" }
        ],
        sql: `SELECT user_id, age, phone, college_name, hostel_name, room_number, cook_cuisine, delivery_vehicle
              FROM user_profiles
              ORDER BY user_id`
      },
      {
        file: "user_sessions.table",
        title: "USER_SESSIONS",
        columns: [
          { key: "ID", label: "id" },
          { key: "USER_ID", label: "user_id" },
          { key: "TOKEN", label: "token" },
          { key: "CREATED_AT", label: "created_at" }
        ],
        sql: `SELECT id, user_id, token, TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
              FROM user_sessions
              ORDER BY created_at DESC`
      },
      {
        file: "menu_items.table",
        title: "MENU_ITEMS",
        columns: [
          { key: "ID", label: "id" },
          { key: "NAME", label: "name" },
          { key: "CATEGORY", label: "category" },
          { key: "PRICE_NEST_COINS", label: "price" },
          { key: "AVAILABLE", label: "available" },
          { key: "COOK_ID", label: "cook_id" },
          { key: "PREPARATION_TIME_MINS", label: "prep_mins" },
          { key: "DESCRIPTION", label: "description" }
        ],
        sql: `SELECT id, name, category, price_nest_coins, available, cook_id, preparation_time_mins, description
              FROM menu_items
              ORDER BY id`
      },
      {
        file: "orders.table",
        title: "ORDERS",
        columns: [
          { key: "ID", label: "id" },
          { key: "STUDENT_ID", label: "student_id" },
          { key: "COOK_ID", label: "cook_id" },
          { key: "TOTAL_NEST_COINS", label: "total" },
          { key: "PAYMENT_METHOD", label: "payment_method" },
          { key: "PAYMENT_STATUS", label: "payment_status" },
          { key: "STATUS", label: "status" },
          { key: "CREATED_AT", label: "created_at" }
        ],
        sql: `SELECT id, student_id, cook_id, total_nest_coins, payment_method, payment_status, status,
                     TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
              FROM orders
              ORDER BY created_at DESC`
      },
      {
        file: "order_items.table",
        title: "ORDER_ITEMS",
        columns: [
          { key: "ID", label: "id" },
          { key: "ORDER_ID", label: "order_id" },
          { key: "MENU_ITEM_ID", label: "menu_item_id" },
          { key: "QUANTITY", label: "quantity" },
          { key: "UNIT_PRICE_NEST_COINS", label: "unit_price" },
          { key: "LINE_TOTAL_NEST_COINS", label: "line_total" }
        ],
        sql: `SELECT id, order_id, menu_item_id, quantity, unit_price_nest_coins, line_total_nest_coins
              FROM order_items
              ORDER BY order_id, id`
      },
      {
        file: "delivery_assignments.table",
        title: "DELIVERY_ASSIGNMENTS",
        columns: [
          { key: "ID", label: "id" },
          { key: "ORDER_ID", label: "order_id" },
          { key: "DELIVERY_PARTNER_ID", label: "delivery_partner_id" },
          { key: "DELIVERY_STATUS", label: "delivery_status" },
          { key: "PICKUP_LOCATION", label: "pickup_location" },
          { key: "DROP_LOCATION", label: "drop_location" }
        ],
        sql: `SELECT id, order_id, delivery_partner_id, delivery_status, pickup_location, drop_location
              FROM delivery_assignments
              ORDER BY assigned_at DESC NULLS LAST`
      },
      {
        file: "delivery_tracking.table",
        title: "DELIVERY_TRACKING",
        columns: [
          { key: "ORDER_ID", label: "order_id" },
          { key: "ORDER_STATUS", label: "order_status" },
          { key: "DELIVERY_STATUS", label: "delivery_status" },
          { key: "DELIVERY_PARTNER", label: "delivery_partner" },
          { key: "PICKUP_LOCATION", label: "pickup_location" },
          { key: "DROP_LOCATION", label: "drop_location" }
        ],
        sql: `SELECT o.id AS order_id, o.status AS order_status, da.delivery_status,
                     u.name AS delivery_partner, da.pickup_location, da.drop_location
              FROM orders o
              LEFT JOIN delivery_assignments da ON da.order_id = o.id
              LEFT JOIN users u ON u.id = da.delivery_partner_id
              ORDER BY o.created_at DESC`
      },
      {
        file: "order_status_history.table",
        title: "ORDER_STATUS_HISTORY",
        columns: [
          { key: "ID", label: "id" },
          { key: "ORDER_ID", label: "order_id" },
          { key: "STAGE", label: "stage" },
          { key: "SIMULATED", label: "simulated" },
          { key: "CHANGED_AT", label: "changed_at" }
        ],
        sql: `SELECT id, order_id, stage, simulated,
                     TO_CHAR(changed_at, 'YYYY-MM-DD HH24:MI:SS') AS changed_at
              FROM order_status_history
              ORDER BY changed_at DESC`
      },
      {
        file: "feedback.table",
        title: "FEEDBACK",
        columns: [
          { key: "ID", label: "id" },
          { key: "ORDER_ID", label: "order_id" },
          { key: "RATING", label: "rating" },
          { key: "REVIEW_TEXT", label: "review_text" },
          { key: "REWARD_DISTRIBUTED", label: "reward_distributed" },
          { key: "SUBMITTED_AT", label: "submitted_at" }
        ],
        sql: `SELECT id, order_id, rating, review_text, reward_distributed,
                     TO_CHAR(submitted_at, 'YYYY-MM-DD HH24:MI:SS') AS submitted_at
              FROM feedback
              ORDER BY submitted_at DESC`
      }
    ];

    for (const view of views) {
      const result = await connection.execute(view.sql, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      fs.writeFileSync(path.join(liveDbDir, view.file), formatTable(view.title, view.columns, result.rows), "utf8");
    }
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

function queueLiveDbRefresh() {
  refreshChain = refreshChain
    .catch(() => {})
    .then(() => writeLiveDbViews())
    .catch((error) => {
      console.error("Live DB view refresh failed:", error.message);
    });

  return refreshChain;
}

module.exports = { queueLiveDbRefresh };
