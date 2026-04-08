const express = require("express");
const oracledb = require("oracledb");
const { getConnection } = require("../config/db");
const { createId } = require("../utils/ids");
const { requireAuth } = require("../middleware/auth");
const { computeFiveStarReward, applyHostellerTopUp } = require("../utils/coins");

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

    const stats = await connection.execute(
      `SELECT
         COUNT(*) AS TOTAL_ORDERS,
         SUM(CASE WHEN status <> 'Delivered' THEN 1 ELSE 0 END) AS ACTIVE_ORDERS
       FROM orders
       WHERE student_id = :student_id`,
      { student_id: studentId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({
      message: "Student dashboard loaded.",
      student: req.user,
      totalOrders: stats.rows[0].TOTAL_ORDERS,
      activeOrders: stats.rows[0].ACTIVE_ORDERS
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
      `SELECT
         mi.id,
         mi.name,
         mi.category,
         mi.price_nest_coins,
         mi.preparation_time_mins,
         mi.image_url,
         mi.description,
         mi.available,
         u.name AS cook_name,
         NVL(ROUND(r.avg_rating, 1), 0) AS avg_rating
       FROM menu_items mi
       LEFT JOIN users u ON u.id = mi.cook_id
       LEFT JOIN (
         SELECT oi.menu_item_id, AVG(f.rating) AS avg_rating
         FROM feedback f
         JOIN orders o ON o.id = f.order_id
         JOIN order_items oi ON oi.order_id = o.id
         GROUP BY oi.menu_item_id
       ) r ON r.menu_item_id = mi.id
       WHERE mi.available = 1
       AND mi.id LIKE 'hostel-meal-%'
       ORDER BY mi.id`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({
      items: result.rows.map((row) => ({
        id: row.ID,
        name: row.NAME,
        category: row.CATEGORY,
        priceNestCoins: row.PRICE_NEST_COINS,
        preparationTimeMins: row.PREPARATION_TIME_MINS,
        imageUrl: row.IMAGE_URL,
        description: row.DESCRIPTION,
        available: row.AVAILABLE,
        cookName: row.COOK_NAME || "FoodNest Kitchen",
        averageRating: Number(row.AVG_RATING || 0)
      }))
    });
  } catch (error) {
    res.status(500).json({ message: "Menu fetch failed.", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

router.get("/orders", async (req, res) => {
  const role = req.user.ROLE || req.user.role;
  const studentId = req.user.ID || req.user.id;

  if (role !== "student") {
    return res.status(403).json({ message: "Only students allowed." });
  }

  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT
         o.id AS order_id,
         o.total_nest_coins,
         o.payment_method,
         o.payment_status,
         o.status AS order_status,
         o.created_at,
         c.name AS cook_name,
         dp.name AS delivery_partner_name,
         da.delivery_status,
         da.pickup_location,
         da.drop_location,
         da.estimated_time_mins,
         da.distance_km,
         f.rating AS feedback_rating,
         f.review_text,
         f.reward_distributed,
         LISTAGG(mi.name || ' x' || oi.quantity, ', ')
           WITHIN GROUP (ORDER BY mi.name) AS items_summary
       FROM orders o
       LEFT JOIN users c ON c.id = o.cook_id
       LEFT JOIN delivery_assignments da ON da.order_id = o.id
       LEFT JOIN users dp ON dp.id = da.delivery_partner_id
       LEFT JOIN feedback f ON f.order_id = o.id
       JOIN order_items oi ON oi.order_id = o.id
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE o.student_id = :student_id
       GROUP BY
         o.id, o.total_nest_coins, o.payment_method, o.payment_status, o.status, o.created_at,
         c.name, dp.name, da.delivery_status, da.pickup_location, da.drop_location,
         da.estimated_time_mins, da.distance_km, f.rating, f.review_text, f.reward_distributed
       ORDER BY o.created_at DESC`,
      { student_id: studentId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({
      orders: result.rows.map((row) => ({
        orderId: row.ORDER_ID,
        totalNestCoins: row.TOTAL_NEST_COINS,
        paymentMethod: row.PAYMENT_METHOD,
        paymentStatus: row.PAYMENT_STATUS,
        orderStatus: row.ORDER_STATUS,
        createdAt: row.CREATED_AT,
        cookName: row.COOK_NAME || "Awaiting cook assignment",
        deliveryPartnerName: row.DELIVERY_PARTNER_NAME || "Awaiting delivery partner",
        deliveryStatus: row.DELIVERY_STATUS || "Pending",
        pickupLocation: row.PICKUP_LOCATION || "Home Cook Hub",
        dropLocation: row.DROP_LOCATION || "Hosteller Address",
        estimatedTimeMins: row.ESTIMATED_TIME_MINS || null,
        distanceKm: row.DISTANCE_KM || null,
        feedbackRating: row.FEEDBACK_RATING || null,
        reviewText: row.REVIEW_TEXT || null,
        rewardDistributed: row.REWARD_DISTRIBUTED || 0,
        itemsSummary: row.ITEMS_SUMMARY
      }))
    });
  } catch (error) {
    res.status(500).json({ message: "Orders fetch failed.", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

router.post("/orders", async (req, res) => {
  const { items, paymentMethod = "Wallet" } = req.body;
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

    const balanceAfterSpend = balance - total;
    const topUp = applyHostellerTopUp(balanceAfterSpend);

    await connection.execute(
      `UPDATE users
       SET nest_coins = :final_balance
       WHERE id = :id`,
      { final_balance: topUp.finalBalance, id: studentId }
    );

    await connection.execute(
      `INSERT INTO orders
       (id, student_id, cook_id, total_nest_coins, payment_method, payment_status, status)
       VALUES (:id, :student_id, :cook_id, :total, :payment_method, 'Paid', 'Order Placed')`,
      {
        id: orderId,
        student_id: studentId,
        cook_id: cookId,
        total,
        payment_method: paymentMethod
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

    const estimatedTimeMins = maxPreparationTime + (15 + Math.floor(Math.random() * 16));
    const distanceKm = Number((2 + Math.random() * 5).toFixed(1));

    await connection.execute(
      `INSERT INTO delivery_assignments
       (id, order_id, delivery_partner_id, delivery_status, pickup_location, drop_location, estimated_time_mins, distance_km)
       VALUES
       (:id, :order_id, :delivery_partner_id, 'Pending Acceptance', 'Home Cook Hub', 'Hosteller Address', :estimated_time_mins, :distance_km)`,
      {
        id: createId("da"),
        order_id: orderId,
        delivery_partner_id: null,
        estimated_time_mins: estimatedTimeMins,
        distance_km: distanceKm
      }
    );

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
      totalNestCoins: total,
      newBalance: topUp.finalBalance,
      topUpAdded: topUp.topUpAdded,
      popupMessage: topUp.topUpAdded > 0 ? "500 NestCoins added" : null
    });
  } catch (error) {
    res.status(500).json({ message: "Order failed.", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

router.post("/orders/:orderId/feedback", async (req, res) => {
  const { rating, reviewText = null } = req.body;
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

    const orderResult = await connection.execute(
      `SELECT o.id, o.total_nest_coins, o.student_id, o.cook_id, da.delivery_partner_id
       FROM orders o
       LEFT JOIN delivery_assignments da ON da.order_id = o.id
       WHERE o.id = :order_id`,
      { order_id: orderId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: "Order not found." });
    }

    const order = orderResult.rows[0];

    await connection.execute(
      `INSERT INTO feedback (id, order_id, rating, review_text, reward_distributed)
       VALUES (:id, :order_id, :rating, :review_text, :reward_distributed)`,
      {
        id: createId("fb"),
        order_id: orderId,
        rating,
        review_text: reviewText,
        reward_distributed: rating === 5 ? 1 : 0
      }
    );

    let reward = null;
    if (Number(rating) === 5) {
      reward = computeFiveStarReward(order.TOTAL_NEST_COINS);

      await connection.execute(
        `UPDATE users SET nest_coins = nest_coins + :reward WHERE id = :id`,
        { reward: reward.studentShare, id: order.STUDENT_ID }
      );

      if (order.COOK_ID) {
        await connection.execute(
          `UPDATE users SET nest_coins = nest_coins + :reward WHERE id = :id`,
          { reward: reward.cookShare, id: order.COOK_ID }
        );
      }

      if (order.DELIVERY_PARTNER_ID) {
        await connection.execute(
          `UPDATE users SET nest_coins = nest_coins + :reward WHERE id = :id`,
          { reward: reward.deliveryShare, id: order.DELIVERY_PARTNER_ID }
        );
      }
    }

    await connection.commit();

    res.json({
      message: "Feedback submitted successfully.",
      reward
    });
  } catch (error) {
    res.status(500).json({ message: "Feedback failed.", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

module.exports = router;
