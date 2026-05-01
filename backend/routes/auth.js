const express = require("express");
const crypto = require("crypto");
const fs = require("fs/promises");
const oracledb = require("oracledb");
const path = require("path");
const { getConnection } = require("../config/db");
const { requireAuth } = require("../middleware/auth");
const { createId } = require("../utils/ids");
const { hashPassword, verifyPassword } = require("../utils/passwords");
const { getStarterMenuIdsForCuisine } = require("../utils/starterMenus");
const { queueLiveDbRefresh } = require("../utils/liveDbView");

const router = express.Router();
const allowedRoles = ["student", "cook", "delivery"];
const uploadDir = path.join(__dirname, "..", "uploads");
const allowedIdCardTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"]
]);
const maxIdCardBytes = 5 * 1024 * 1024;

async function saveOptionalIdCardPhoto(photo) {
  if (!photo || !photo.data) {
    return;
  }

  const extension = allowedIdCardTypes.get(photo.type);
  if (!extension) {
    const error = new Error("ID card photo must be a JPG, PNG, or WebP image.");
    error.statusCode = 400;
    throw error;
  }

  const fileBuffer = Buffer.from(String(photo.data), "base64");
  if (fileBuffer.length > maxIdCardBytes) {
    const error = new Error("ID card photo must be 5 MB or smaller.");
    error.statusCode = 400;
    throw error;
  }

  await fs.mkdir(uploadDir, { recursive: true });
  const fileName = `hosteller-id-${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;
  await fs.writeFile(path.join(uploadDir, fileName), fileBuffer);
}

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
      distanceFromHostel: row.DISTANCE_FROM_HOSTEL,
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
    cookDistance = null,
    deliveryPhoneConfirm = null,
    deliveryAltPhone = null,
    deliveryVehicle = null,
    deliveryHours = null,
    deliveryShift = null,
    idCardPhoto = null
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

  if (role === "cook" && (!cookExperience || !cookCuisine || !cookAvailability || cookDistance === null)) {
    return res.status(400).json({ message: "Home cook details are required." });
  }

  const normalizedDeliveryVehicle = deliveryVehicle || null;
  const normalizedDeliveryShift = deliveryShift || "All Day";

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

    if (role === "student") {
      await saveOptionalIdCardPhoto(idCardPhoto);
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
        cook_availability, distance_from_hostel, delivery_contact_phone, delivery_alt_phone, delivery_vehicle, delivery_hours, delivery_shift)
       VALUES
       (:user_id, :age, :phone, :college_name, :hostel_address, :hostel_name, :room_number, :cook_experience_years, :cook_cuisine,
        :cook_availability, :distance_from_hostel, :delivery_contact_phone, :delivery_alt_phone, :delivery_vehicle, :delivery_hours, :delivery_shift)`,
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
        distance_from_hostel: cookDistance ? Number(cookDistance) : null,
        delivery_contact_phone: deliveryPhoneConfirm || phone,
        delivery_alt_phone: deliveryAltPhone || null,
        delivery_vehicle: normalizedDeliveryVehicle,
        delivery_hours: deliveryHours || null,
        delivery_shift: normalizedDeliveryShift
      }
    );

    if (role === "delivery") {
      await connection.execute(
        `INSERT INTO delivery_agents
         (user_id, phone, alternate_phone, vehicle_type, available_hours, shift)
         VALUES
         (:user_id, :phone, :alternate_phone, :vehicle_type, :available_hours, :shift)`,
        {
          user_id: userId,
          phone: deliveryPhoneConfirm || phone,
          alternate_phone: deliveryAltPhone || null,
          vehicle_type: normalizedDeliveryVehicle,
          available_hours: deliveryHours || null,
          shift: normalizedDeliveryShift
        }
      );
    }

    if (role === "cook") {
      const starterMenuIds = getStarterMenuIdsForCuisine(cookCuisine);
      await connection.execute(
        `UPDATE menu_items
         SET cook_id = :cook_id
         WHERE id IN (${starterMenuIds.map((_, index) => `:menu_id_${index}`).join(", ")})
         AND cook_id IS NULL`,
        starterMenuIds.reduce(
          (params, id, index) => {
            params[`menu_id_${index}`] = id;
            return params;
          },
          { cook_id: userId }
        )
      );
    }

    await connection.commit();

    await queueLiveDbRefresh();

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
          distanceFromHostel: cookDistance ? Number(cookDistance) : null,
          deliveryContactPhone: deliveryPhoneConfirm || phone,
          deliveryAlternatePhone: deliveryAltPhone || null,
          deliveryVehicle: normalizedDeliveryVehicle,
          deliveryHours,
          deliveryShift: normalizedDeliveryShift
        }
      }
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Signup failed.",
      error: error.message
    });
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
         p.cook_cuisine, p.cook_availability, p.distance_from_hostel, p.delivery_contact_phone, p.delivery_alt_phone,
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
    await queueLiveDbRefresh();

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

router.post("/reset-password", async (req, res) => {
  const { identifier, role, age, password } = req.body;
  const loginValue = String(identifier || "").trim();
  const normalizedRole = String(role || "").trim();
  const normalizedAge = Number(age);

  if (!loginValue || !normalizedRole || !age || !password) {
    return res.status(400).json({ message: "Role, username or phone, age, and new password are required." });
  }

  if (!allowedRoles.includes(normalizedRole)) {
    return res.status(400).json({ message: "Invalid role." });
  }

  if (!Number.isInteger(normalizedAge) || normalizedAge < 1) {
    return res.status(400).json({ message: "Enter a valid age." });
  }

  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT u.id
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE (u.username = :login_value OR p.phone = :login_value)
       AND u.role = :role
       AND p.age = :age`,
      {
        login_value: loginValue,
        role: normalizedRole,
        age: normalizedAge
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Could not verify account details." });
    }

    const userId = result.rows[0].ID;
    await connection.execute(
      `UPDATE users
       SET password_hash = :password_hash
       WHERE id = :id`,
      {
        id: userId,
        password_hash: hashPassword(password)
      }
    );

    await connection.execute(
      `DELETE FROM user_sessions
       WHERE user_id = :user_id`,
      { user_id: userId }
    );

    await connection.commit();
    await queueLiveDbRefresh();

    res.json({ message: "Password reset successful. Please log in with your new password." });
  } catch (error) {
    res.status(500).json({ message: "Password reset failed.", error: error.message });
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
         p.cook_cuisine, p.cook_availability, p.distance_from_hostel, p.delivery_contact_phone, p.delivery_alt_phone,
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

router.put("/profile", requireAuth, async (req, res) => {
  const userId = req.user.ID || req.user.id;
  const role = req.user.ROLE || req.user.role;

  const {
    age,
    phone,
    college,
    address,
    hostelName,
    roomNumber,
    cookExperience,
    cookCuisine,
    cookAvailability,
    cookDistance,
    deliveryAltPhone,
    deliveryVehicle,
    deliveryHours,
    deliveryShift
  } = req.body;

  let connection;

  try {
    connection = await getConnection();

    // Build update query dynamically based on provided fields
    const updates = [];
    const params = { user_id: userId };

    if (age !== undefined) {
      updates.push("age = :age");
      params.age = age ? Number(age) : null;
    }
    if (phone !== undefined) {
      updates.push("phone = :phone");
      params.phone = phone;
    }
    if (college !== undefined) {
      updates.push("college_name = :college_name");
      params.college_name = college;
    }
    if (address !== undefined) {
      updates.push("hostel_address = :hostel_address");
      params.hostel_address = address;
    }
    if (hostelName !== undefined) {
      updates.push("hostel_name = :hostel_name");
      params.hostel_name = hostelName;
    }
    if (roomNumber !== undefined) {
      updates.push("room_number = :room_number");
      params.room_number = roomNumber;
    }
    if (cookExperience !== undefined) {
      updates.push("cook_experience_years = :cook_experience_years");
      params.cook_experience_years = cookExperience ? Number(cookExperience) : null;
    }
    if (cookCuisine !== undefined) {
      updates.push("cook_cuisine = :cook_cuisine");
      params.cook_cuisine = cookCuisine;
    }
    if (cookAvailability !== undefined) {
      updates.push("cook_availability = :cook_availability");
      params.cook_availability = cookAvailability;
    }
    if (cookDistance !== undefined) {
      updates.push("distance_from_hostel = :distance_from_hostel");
      params.distance_from_hostel = cookDistance ? Number(cookDistance) : null;
    }
    if (deliveryAltPhone !== undefined) {
      updates.push("delivery_alt_phone = :delivery_alt_phone");
      params.delivery_alt_phone = deliveryAltPhone;
    }
    if (deliveryVehicle !== undefined) {
      updates.push("delivery_vehicle = :delivery_vehicle");
      params.delivery_vehicle = deliveryVehicle;
    }
    if (deliveryHours !== undefined) {
      updates.push("delivery_hours = :delivery_hours");
      params.delivery_hours = deliveryHours;
    }
    if (deliveryShift !== undefined) {
      updates.push("delivery_shift = :delivery_shift");
      params.delivery_shift = deliveryShift;
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "No fields to update." });
    }

    await connection.execute(
      `UPDATE user_profiles SET ${updates.join(", ")} WHERE user_id = :user_id`,
      params
    );

    await connection.commit();
    await queueLiveDbRefresh();

    res.json({ message: "Profile updated successfully." });
  } catch (error) {
    res.status(500).json({ message: "Profile update failed.", error: error.message });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

module.exports = router;

