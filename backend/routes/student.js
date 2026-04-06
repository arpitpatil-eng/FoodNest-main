const express = require("express");
const oracledb = require("oracledb");
const { getConnection } = require("../config/db");
const { createId } = require("../utils/ids");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/dashboard", async (req, res) => {
  const role = req.user.ROLE || req.user.role;
  const studentId = req.user.ID || req.user.id;

  if (role !== "student") {
    return res.status(403).json({ message: "Only students allowed." });
  }

  let connection;

  try {
    connection = await getConnection();

    const orders = await connection.execute(
      `SELECT COUNT(*) AS TOTAL_ORDERS
       FROM orders
       WHERE student_id = :student_id`,
      { student_id: studentId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({
      message: "Student dashboard loaded.",
      student: req.user,
      totalOrders: orders.rows[0].TOTAL_ORDERS
    });
  } catch (error) {
    res.status(500).json({ message: "Dashboard error.", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

router.get("/menu", async (_req, res) => {
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT id, name, category, price_nest_coins, preparation_time_mins, image_url, description, available
       FROM menu_items
       WHERE available = 1`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({ items: result.rows });
  } catch (error) {
    res.status(500).json({ message: "Menu fetch failed.", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

router.post("/orders", async (req, res) => {
  const { items } = req.body;
  const role = req.user.ROLE || req.user.role;
  const studentId = req.user.ID || req.user.id;

  if (role !== "student") {
    return res.status(403).json({ message: "Only students allowed." });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Items required." });
  }

  let connection;

  try {
    connection = await getConnection();

    const studentResult = await connection.execute(
      `SELECT nest_coins FROM users WHERE id = :id`,
      { id: studentId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const balance = studentResult.rows[0].NEST_COINS;
    const orderId = createId("order");
    const orderItems = [];
    const cookIds = new Set();
    let maxPreparationTime = 0;
    let total = 0;

    for (const item of items) {
      const menuResult = await connection.execute(
        `SELECT id, cook_id, price_nest_coins, preparation_time_mins
         FROM menu_items
         WHERE id = :id AND available = 1`,
        { id: item.menuItemId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (menuResult.rows.length === 0) {
        return res.status(400).json({ message: `Invalid menu item ${item.menuItemId}` });
      }

      const menuItem = menuResult.rows[0];
      if (menuItem.COOK_ID) {
        cookIds.add(menuItem.COOK_ID);
      }
      const quantity = Number(item.quantity || 1);
      const lineTotal = menuItem.PRICE_NEST_COINS * quantity;
      maxPreparationTime = Math.max(maxPreparationTime, Number(menuItem.PREPARATION_TIME_MINS || 20));
      total += lineTotal;
      orderItems.push({
        menuItemId: menuItem.ID,
        quantity,
        unitPrice: menuItem.PRICE_NEST_COINS,
        lineTotal
      });
    }

    if (cookIds.size > 1) {
      return res.status(400).json({
        message: "Please order items from a single home cook in one order."
      });
    }

    if (balance < total) {
      return res.status(400).json({ message: "Insufficient NestCoins." });
    }

    const cookId = cookIds.size === 1 ? Array.from(cookIds)[0] : null;

    await connection.execute(
      `UPDATE users
       SET nest_coins = nest_coins - :total
       WHERE id = :id`,
      { total, id: studentId }
    );

    await connection.execute(
      `INSERT INTO orders
       (id, student_id, cook_id, total_nest_coins, payment_method, payment_status, status)
       VALUES (:id, :student_id, :cook_id, :total, 'NestCoins', 'Paid', 'Order Placed')`,
      {
        id: orderId,
        student_id: studentId,
        cook_id: cookId,
        total
      }
    );

    for (const item of orderItems) {
      await connection.execute(
        `INSERT INTO order_items
         (id, order_id, menu_item_id, quantity, unit_price_nest_coins, line_total_nest_coins)
         VALUES (:id, :order_id, :menu_item_id, :quantity, :unit_price, :line_total)`,
        {
          id: createId("oi"),
          order_id: orderId,
          menu_item_id: item.menuItemId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          line_total: item.lineTotal
        }
      );
    }

    const deliveryPartnerResult = await connection.execute(
      `SELECT id
       FROM users
       WHERE role = 'delivery'
       ORDER BY created_at
       FETCH FIRST 1 ROWS ONLY`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (deliveryPartnerResult.rows.length > 0) {
      const deliveryPartnerId = deliveryPartnerResult.rows[0].ID;
      const estimatedTimeMins = maxPreparationTime + (15 + Math.floor(Math.random() * 16));
      const distanceKm = Number((2 + Math.random() * 5).toFixed(1));

      await connection.execute(
        `INSERT INTO delivery_assignments
         (id, order_id, delivery_partner_id, delivery_status, pickup_location, drop_location, estimated_time_mins, distance_km)
         VALUES
         (:id, :order_id, :delivery_partner_id, 'Assigned', 'Home Cook Hub', 'Hosteller Address', :estimated_time_mins, :distance_km)`,
        {
          id: createId("da"),
          order_id: orderId,
          delivery_partner_id: deliveryPartnerId,
          estimated_time_mins: estimatedTimeMins,
          distance_km: distanceKm
        }
      );
    }

    await connection.execute(
      `INSERT INTO order_status_history (id, order_id, stage, simulated)
       VALUES (:id, :order_id, 'Order Placed', 1)`,
      {
        id: createId("osh"),
        order_id: orderId
      },
      { autoCommit: true }
    );

    res.status(201).json({
      message: "Order placed successfully.",
      orderId,
      totalNestCoins: total
    });
  } catch (error) {
    res.status(500).json({ message: "Order failed.", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

router.post("/orders/:orderId/feedback", async (req, res) => {
  const { rating } = req.body;
  const { orderId } = req.params;
  const role = req.user.ROLE || req.user.role;

  if (role !== "student") {
    return res.status(403).json({ message: "Only students allowed." });
  }

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: "Rating must be 1 to 5." });
  }

  let connection;

  try {
    connection = await getConnection();

    await connection.execute(
      `INSERT INTO feedback (id, order_id, rating)
       VALUES (:id, :order_id, :rating)`,
      {
        id: createId("fb"),
        order_id: orderId,
        rating
      },
      { autoCommit: true }
    );

    res.json({ message: "Feedback submitted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Feedback failed.", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

module.exports = router;
