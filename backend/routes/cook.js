const express = require("express");
const oracledb = require("oracledb");
const { getConnection } = require("../config/db");
const { createId } = require("../utils/ids");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const allowedCookStatuses = ["Accepted", "Preparing", "Ready for Pickup"];

router.use(requireAuth);

function isCook(req) {
  const role = req.user.ROLE || req.user.role;
  return role === "cook";
}

router.get("/menu", async (req, res) => {
  if (!isCook(req)) {
    return res.status(403).json({ message: "Only home cooks allowed." });
  }

  const cookId = req.user.ID || req.user.id;
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT id, name, category, price_nest_coins, preparation_time_mins, image_url, description, available
       FROM menu_items
       WHERE cook_id = :cook_id
       ORDER BY name`,
      { cook_id: cookId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({ items: result.rows });
  } catch (error) {
    res.status(500).json({ message: "Menu fetch failed.", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

router.post("/menu", async (req, res) => {
  if (!isCook(req)) {
    return res.status(403).json({ message: "Only home cooks allowed." });
  }

  const {
    name,
    description = null,
    category = "Veg",
    priceNestCoins,
    preparationTimeMins = 20,
    imageUrl = null
  } = req.body;
  const cookId = req.user.ID || req.user.id;

  if (!name || !priceNestCoins) {
    return res.status(400).json({ message: "name and priceNestCoins are required." });
  }

  let connection;

  try {
    connection = await getConnection();
    const itemId = createId("meal");

    await connection.execute(
      `INSERT INTO menu_items
       (id, cook_id, name, category, price_nest_coins, preparation_time_mins, image_url, description, available)
       VALUES
       (:id, :cook_id, :name, :category, :price_nest_coins, :preparation_time_mins, :image_url, :description, 1)`,
      {
        id: itemId,
        cook_id: cookId,
        name,
        category,
        price_nest_coins: Number(priceNestCoins),
        preparation_time_mins: Number(preparationTimeMins),
        image_url: imageUrl,
        description
      },
      { autoCommit: true }
    );

    res.status(201).json({
      message: "Menu item created.",
      itemId
    });
  } catch (error) {
    res.status(500).json({ message: "Menu create failed.", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

router.put("/menu/:id", async (req, res) => {
  if (!isCook(req)) {
    return res.status(403).json({ message: "Only home cooks allowed." });
  }

  const cookId = req.user.ID || req.user.id;
  const { id } = req.params;
  const { name, description, category, priceNestCoins, preparationTimeMins, imageUrl, available } = req.body;

  let connection;

  try {
    connection = await getConnection();

    const existing = await connection.execute(
      `SELECT id
       FROM menu_items
       WHERE id = :id AND cook_id = :cook_id`,
      { id, cook_id: cookId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Menu item not found for this cook." });
    }

    await connection.execute(
      `UPDATE menu_items
       SET name = COALESCE(:name, name),
           description = COALESCE(:description, description),
           category = COALESCE(:category, category),
           price_nest_coins = COALESCE(:price_nest_coins, price_nest_coins),
           preparation_time_mins = COALESCE(:preparation_time_mins, preparation_time_mins),
           image_url = COALESCE(:image_url, image_url),
           available = COALESCE(:available, available)
       WHERE id = :id
       AND cook_id = :cook_id`,
      {
        name: name ?? null,
        description: description ?? null,
        category: category ?? null,
        price_nest_coins: priceNestCoins ?? null,
        preparation_time_mins: preparationTimeMins ?? null,
        image_url: imageUrl ?? null,
        available: available === undefined ? null : Number(available ? 1 : 0),
        id,
        cook_id: cookId
      },
      { autoCommit: true }
    );

    res.json({ message: "Menu item updated." });
  } catch (error) {
    res.status(500).json({ message: "Menu update failed.", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

router.delete("/menu/:id", async (req, res) => {
  if (!isCook(req)) {
    return res.status(403).json({ message: "Only home cooks allowed." });
  }

  const cookId = req.user.ID || req.user.id;
  const { id } = req.params;
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `UPDATE menu_items
       SET available = 0
       WHERE id = :id
       AND cook_id = :cook_id`,
      { id, cook_id: cookId },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({ message: "Menu item not found for this cook." });
    }

    res.json({ message: "Menu item deleted." });
  } catch (error) {
    res.status(500).json({ message: "Menu delete failed.", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

router.get("/orders/cook", async (req, res) => {
  if (!isCook(req)) {
    return res.status(403).json({ message: "Only home cooks allowed." });
  }

  const cookId = req.user.ID || req.user.id;
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT
         o.id AS order_id,
         o.status AS order_status,
         o.total_nest_coins,
         o.created_at,
         u.id AS student_id,
         u.name AS student_name,
         da.drop_location,
         da.estimated_time_mins,
         LISTAGG(mi.name || ' x' || oi.quantity, ', ')
           WITHIN GROUP (ORDER BY mi.name) AS items_summary
       FROM orders o
       JOIN users u ON u.id = o.student_id
       LEFT JOIN delivery_assignments da ON da.order_id = o.id
       JOIN order_items oi ON oi.order_id = o.id
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE o.cook_id = :cook_id
       AND o.status NOT IN ('Delivered')
       GROUP BY
         o.id, o.status, o.total_nest_coins, o.created_at, u.id, u.name,
         da.drop_location, da.estimated_time_mins
       ORDER BY o.created_at DESC`,
      { cook_id: cookId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({
      message: "Cook orders fetched.",
      orders: result.rows
    });
  } catch (error) {
    res.status(500).json({ message: "Cook orders fetch failed.", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

router.put("/order/status", async (req, res, next) => {
  if (!isCook(req)) {
    return next();
  }

  const { orderId, status } = req.body;
  const cookId = req.user.ID || req.user.id;

  if (!orderId || !status) {
    return res.status(400).json({ message: "orderId and status are required." });
  }

  if (!allowedCookStatuses.includes(status)) {
    return res.status(400).json({
      message: `Invalid status. Allowed: ${allowedCookStatuses.join(", ")}.`
    });
  }

  let connection;

  try {
    connection = await getConnection();

    const orderResult = await connection.execute(
      `SELECT id
       FROM orders
       WHERE id = :id
       AND cook_id = :cook_id`,
      {
        id: orderId,
        cook_id: cookId
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: "Order not found for this cook." });
    }

    await connection.execute(
      `UPDATE orders
       SET status = :status
       WHERE id = :order_id
       AND cook_id = :cook_id`,
      {
        status,
        order_id: orderId,
        cook_id: cookId
      }
    );

    await connection.execute(
      `INSERT INTO order_status_history (id, order_id, stage, simulated)
       VALUES (:id, :order_id, :stage, 0)`,
      {
        id: createId("osh"),
        order_id: orderId,
        stage: status
      },
      { autoCommit: true }
    );

    res.json({ message: "Cook order status updated.", orderId, status });
  } catch (error) {
    res.status(500).json({ message: "Cook status update failed.", error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

module.exports = router;
