const express = require("express");
const crypto = require("crypto");
const oracledb = require("oracledb");
const { getConnection } = require("../config/db");
const { requireAuth } = require("../middleware/auth");
const { createId } = require("../utils/ids");
const { hashPassword, verifyPassword } = require("../utils/passwords");
const { getStarterMenusForCuisine } = require("../utils/starterMenus");

const router = express.Router();
const allowedRoles = ["student", "cook", "delivery"];

function buildUserResponse(row) {
  return {
    id: row.ID,
    name: row.NAME,
    username: row.USERNAME,
    role: row.ROLE,
    nestCoins: row.NEST_COINS,
    profile: {
      age: row.AGE,
      phone: row.PHONE,
      collegeName: row.COLLEGE_NAME,
      hostelAddress: row.HOSTEL_ADDRESS,
      hostelName: row.HOSTEL_NAME,
      roomNumber: row.ROOM_NUMBER,
      cookExperienceYears: row.COOK_EXPERIENCE_YEARS,
      cookCuisine: row.COOK_CUISINE,
      cookAvailability: row.COOK_AVAILABILITY,
      deliveryContactPhone: row.DELIVERY_CONTACT_PHONE,
      deliveryAlternatePhone: row.DELIVERY_ALT_PHONE,
      deliveryVehicle: row.DELIVERY_VEHICLE,
      deliveryHours: row.DELIVERY_HOURS,
      deliveryShift: row.DELIVERY_SHIFT
    }
  };
}

router.post("/signup", async (req, res) => {
  const {
    name,
    username,
    password,
    role,
    age = null,
    phone = null,
    college = null,
    address = null,
    hostelName = null,
    roomNumber = null,
    cookExperience = null,
    cookCuisine = null,
    cookAvailability = null,
    deliveryPhoneConfirm = null,
    deliveryAltPhone = null,
    deliveryVehicle = null,
    deliveryHours = null,
    deliveryShift = null
  } = req.body;

  if (!name || !username || !password || !role || !phone) {
    return res.status(400).json({ message: "All fields required." });
  }

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ message: "Invalid role." });
  }

  if (role === "student" && (!age || !college || !address || !hostelName || !roomNumber)) {
    return res.status(400).json({ message: "Hosteller details are required." });
  }

  if ((role === "cook" || role === "delivery") && Number(age) < 18) {
    return res.status(400).json({ message: "Home cooks and delivery agents must be 18 or older." });
  }

  if (role === "cook" && (!cookExperience || !cookCuisine || !cookAvailability)) {
    return res.status(400).json({ message: "Home cook details are required." });
  }

  if (role === "delivery" && (!deliveryPhoneConfirm || !deliveryAltPhone || !deliveryVehicle || !deliveryHours || !deliveryShift)) {
    return res.status(400).json({ message: "Delivery details are required." });
  }

  let connection;

  try {
    connection = await getConnection();

    const existing = await connection.execute(
      `SELECT u.id
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.username = :username OR p.phone = :phone`,
      { username, phone },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Username already exists." });
    }

    const userId = createId("user");
    const passwordHash = hashPassword(password);
    const nestCoins = role === "student" ? 1000 : 0;

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
      }
    );

    await connection.execute(
      `INSERT INTO user_profiles
       (user_id, age, phone, college_name, hostel_address, hostel_name, room_number, cook_experience_years, cook_cuisine,
        cook_availability, delivery_contact_phone, delivery_alt_phone, delivery_vehicle, delivery_hours, delivery_shift)
       VALUES
       (:user_id, :age, :phone, :college_name, :hostel_address, :hostel_name, :room_number, :cook_experience_years, :cook_cuisine,
        :cook_availability, :delivery_contact_phone, :delivery_alt_phone, :delivery_vehicle, :delivery_hours, :delivery_shift)`,
      {
        user_id: userId,
        age: age ? Number(age) : null,
        phone,
        college_name: college,
        hostel_address: address,
        hostel_name: hostelName,
        room_number: roomNumber,
        cook_experience_years: cookExperience ? Number(cookExperience) : null,
        cook_cuisine: cookCuisine,
        cook_availability: cookAvailability,
        delivery_contact_phone: deliveryPhoneConfirm || phone,
        delivery_alt_phone: deliveryAltPhone || null,
        delivery_vehicle: deliveryVehicle,
        delivery_hours: deliveryHours,
        delivery_shift: deliveryShift
      }
    );

    if (role === "cook") {
      const starterMenus = getStarterMenusForCuisine(cookCuisine);
      for (const item of starterMenus) {
        await connection.execute(
          `INSERT INTO menu_items
           (id, cook_id, name, category, price_nest_coins, preparation_time_mins, image_url, description, available)
           VALUES
           (:id, :cook_id, :name, :category, :price_nest_coins, :preparation_time_mins, :image_url, :description, 1)`,
          {
            id: createId("meal"),
            cook_id: userId,
            name: item.name,
            category: item.category,
            price_nest_coins: item.priceNestCoins,
            preparation_time_mins: item.preparationTimeMins,
            image_url: item.imageUrl,
            description: item.description
          }
        );
      }
    }

    await connection.commit();

    res.status(201).json({
      message: "User registered successfully.",
      user: {
        id: userId,
        name,
        username,
        role,
        nestCoins,
        profile: {
          age: age ? Number(age) : null,
          phone,
          collegeName: college,
          hostelAddress: address,
          hostelName,
          roomNumber,
          cookExperienceYears: cookExperience ? Number(cookExperience) : null,
          cookCuisine,
          cookAvailability,
          deliveryContactPhone: deliveryPhoneConfirm || phone,
          deliveryAlternatePhone: deliveryAltPhone || null,
          deliveryVehicle,
          deliveryHours,
          deliveryShift
        }
      }
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
  const { username, identifier, password } = req.body;
  const loginValue = (identifier || username || "").trim();

  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT
         u.id, u.name, u.username, u.password_hash, u.role, u.nest_coins,
         p.age, p.phone, p.college_name, p.hostel_address, p.hostel_name, p.room_number, p.cook_experience_years,
         p.cook_cuisine, p.cook_availability, p.delivery_contact_phone, p.delivery_alt_phone,
         p.delivery_vehicle, p.delivery_hours, p.delivery_shift
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.username = :login_value OR p.phone = :login_value`,
      { login_value: loginValue },
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
      user: buildUserResponse(user)
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
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT
         u.id, u.name, u.username, u.role, u.nest_coins,
         p.age, p.phone, p.college_name, p.hostel_address, p.hostel_name, p.room_number, p.cook_experience_years,
         p.cook_cuisine, p.cook_availability, p.delivery_contact_phone, p.delivery_alt_phone,
         p.delivery_vehicle, p.delivery_hours, p.delivery_shift
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id = :id`,
      { id: req.user.ID || req.user.id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({ user: buildUserResponse(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ message: "Failed to load profile.", error: error.message });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.post("/logout", requireAuth, async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  let connection;

  try {
    connection = await getConnection();
    await connection.execute(
      `DELETE FROM user_sessions WHERE token = :token`,
      { token },
      { autoCommit: true }
    );
    res.json({ message: "Logged out successfully." });
  } catch (error) {
    res.status(500).json({ message: "Logout failed.", error: error.message });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

module.exports = router;

