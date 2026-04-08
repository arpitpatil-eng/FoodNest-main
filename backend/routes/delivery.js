const express = require("express");
const oracledb = require("oracledb");
const { getConnection } = require("../config/db");
const { createId } = require("../utils/ids");
const { requireAuth } = require("../middleware/auth");
const { computeDeliveryPayout } = require("../utils/coins");

const router = express.Router();
const allowedStatuses = ["Out for Delivery", "Delivered"];

router.use(requireAuth);

function ensureDeliveryPartner(req, res) {
  const role = req.user.ROLE || req.user.role;
  return role === "delivery";
}

router.get("/delivery/dashboard", async (req, res) => {
  if (!ensureDeliveryPartner(req, res)) {
    return res.status(403).json({ message: "Only delivery partners allowed." });
  }

  const deliveryPartnerId = req.user.ID || req.user.id;
  let connection;

  try {
    connection = await getConnection();

    const walletResult = await connection.execute(
      `SELECT nest_coins FROM users WHERE id = :id`,
      { id: deliveryPartnerId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const statsResult = await connection.execute(
      `SELECT
         COUNT(*) AS TOTAL_ASSIGNED,
         SUM(CASE WHEN delivery_status = 'Delivered' THEN 1 ELSE 0 END) AS COMPLETED,
         SUM(CASE WHEN TRUNC(assigned_at) = TRUNC(SYSDATE) THEN 1 ELSE 0 END) AS TODAY_DELIVERIES
       FROM delivery_assignments
       WHERE delivery_partner_id = :delivery_partner_id`,
      { delivery_partner_id: deliveryPartnerId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({
      wallet: walletResult.rows[0].NEST_COINS,
      totalAssigned: statsResult.rows[0].TOTAL_ASSIGNED || 0,
      completed: statsResult.rows[0].COMPLETED || 0,
      todayDeliveries: statsResult.rows[0].TODAY_DELIVERIES || 0
    });
  } catch (error) {
    res.status(500).json({ message: "Delivery dashboard failed.", error: error.message });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.get("/deliveries/open", async (req, res) => {
  if (!ensureDeliveryPartner(req, res)) {
    return res.status(403).json({ message: "Only delivery partners allowed." });
  }

  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT
         o.id AS order_id,
         o.total_nest_coins,
         o.created_at,
         c.name AS cook_name,
         u.name AS student_name,
         da.delivery_status,
         da.pickup_location,
         da.drop_location,
         da.estimated_time_mins,
         da.distance_km,
         MIN(mi.image_url) AS preview_image,
         LISTAGG(mi.name || ' x' || oi.quantity, ', ')
           WITHIN GROUP (ORDER BY mi.name) AS items_summary
       FROM delivery_assignments da
       JOIN orders o ON o.id = da.order_id
       JOIN users u ON u.id = o.student_id
       LEFT JOIN users c ON c.id = o.cook_id
       JOIN order_items oi ON oi.order_id = o.id
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE da.delivery_partner_id IS NULL
       AND o.status = 'Prepared'
       GROUP BY
         o.id, o.total_nest_coins, o.created_at, c.name, u.name,
         da.delivery_status, da.pickup_location, da.drop_location,
         da.estimated_time_mins, da.distance_km
       ORDER BY o.created_at DESC`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({
      orders: result.rows.map((row) => ({
        orderId: row.ORDER_ID,
        totalNestCoins: row.TOTAL_NEST_COINS,
        createdAt: row.CREATED_AT,
        cookName: row.COOK_NAME || "Awaiting cook",
        studentName: row.STUDENT_NAME,
        deliveryStatus: row.DELIVERY_STATUS,
        pickupLocation: row.PICKUP_LOCATION,
        dropLocation: row.DROP_LOCATION,
        estimatedTimeMins: row.ESTIMATED_TIME_MINS,
        distanceKm: row.DISTANCE_KM,
        previewImage: row.PREVIEW_IMAGE,
        itemsSummary: row.ITEMS_SUMMARY
      }))
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch open deliveries.", error: error.message });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.post("/deliveries/:orderId/accept", async (req, res) => {
  if (!ensureDeliveryPartner(req, res)) {
    return res.status(403).json({ message: "Only delivery partners allowed." });
  }

  const deliveryPartnerId = req.user.ID || req.user.id;
  const { orderId } = req.params;
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `UPDATE delivery_assignments
       SET delivery_partner_id = :delivery_partner_id,
           delivery_status = 'Delivery Agent Assigned',
           assigned_at = CURRENT_TIMESTAMP
       WHERE order_id = :order_id
       AND delivery_partner_id IS NULL`,
      {
        order_id: orderId,
        delivery_partner_id: deliveryPartnerId
      },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return res.status(409).json({ message: "This delivery is no longer available." });
    }

    await connection.execute(
      `UPDATE orders
       SET status = 'Delivery Agent Assigned'
       WHERE id = :order_id`,
      { order_id: orderId },
      { autoCommit: true }
    );

    await connection.execute(
      `INSERT INTO order_status_history (id, order_id, stage, simulated)
       VALUES (:id, :order_id, 'Delivery Agent Assigned', 0)`,
      {
        id: createId("osh"),
        order_id: orderId
      },
      { autoCommit: true }
    );

    res.json({ message: "Delivery accepted.", orderId });
  } catch (error) {
    res.status(500).json({ message: "Failed to accept delivery.", error: error.message });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.get("/orders/delivery", async (req, res) => {
  if (!ensureDeliveryPartner(req, res)) {
    return res.status(403).json({ message: "Only delivery partners allowed." });
  }

  const deliveryPartnerId = req.user.ID || req.user.id;
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT
         o.id AS order_id,
         o.status AS order_status,
         o.total_nest_coins,
         o.created_at,
         c.name AS cook_name,
         da.delivery_status,
         da.pickup_location,
         da.drop_location,
         da.estimated_time_mins,
         da.distance_km,
         da.assigned_at,
         u.name AS student_name,
         MIN(mi.image_url) AS preview_image,
         LISTAGG(mi.name || ' x' || oi.quantity, ', ')
           WITHIN GROUP (ORDER BY mi.name) AS items_summary
       FROM delivery_assignments da
       JOIN orders o ON o.id = da.order_id
       JOIN users u ON u.id = o.student_id
       LEFT JOIN users c ON c.id = o.cook_id
       JOIN order_items oi ON oi.order_id = o.id
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE da.delivery_partner_id = :delivery_partner_id
       AND da.delivery_status <> 'Delivered'
       GROUP BY
         o.id, o.status, o.total_nest_coins, o.created_at,
         c.name, da.delivery_status, da.pickup_location, da.drop_location,
         da.estimated_time_mins, da.distance_km, da.assigned_at, u.name
       ORDER BY da.assigned_at DESC`,
      { delivery_partner_id: deliveryPartnerId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({
      message: "Assigned delivery orders fetched.",
      orders: result.rows.map((row) => ({
        orderId: row.ORDER_ID,
        orderStatus: row.ORDER_STATUS,
        totalNestCoins: row.TOTAL_NEST_COINS,
        createdAt: row.CREATED_AT,
        cookName: row.COOK_NAME || "Awaiting cook",
        deliveryStatus: row.DELIVERY_STATUS,
        pickupLocation: row.PICKUP_LOCATION,
        dropLocation: row.DROP_LOCATION,
        estimatedTimeMins: row.ESTIMATED_TIME_MINS,
        distanceKm: row.DISTANCE_KM,
        assignedAt: row.ASSIGNED_AT,
        studentName: row.STUDENT_NAME,
        previewImage: row.PREVIEW_IMAGE,
        itemsSummary: row.ITEMS_SUMMARY
      }))
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch delivery orders.", error: error.message });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.get("/orders/delivery/history", async (req, res) => {
  if (!ensureDeliveryPartner(req, res)) {
    return res.status(403).json({ message: "Only delivery partners allowed." });
  }

  const deliveryPartnerId = req.user.ID || req.user.id;
  let connection;

  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT
         o.id AS order_id,
         o.status AS order_status,
         o.total_nest_coins,
         o.created_at,
         u.name AS student_name,
         da.delivery_status,
         da.delivered_at,
         MIN(mi.image_url) AS preview_image,
         LISTAGG(mi.name || ' x' || oi.quantity, ', ')
           WITHIN GROUP (ORDER BY mi.name) AS items_summary
       FROM delivery_assignments da
       JOIN orders o ON o.id = da.order_id
       JOIN users u ON u.id = o.student_id
       JOIN order_items oi ON oi.order_id = o.id
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE da.delivery_partner_id = :delivery_partner_id
       GROUP BY
         o.id, o.status, o.total_nest_coins, o.created_at, u.name,
         da.delivery_status, da.delivered_at
       ORDER BY o.created_at DESC`,
      { delivery_partner_id: deliveryPartnerId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({
      orders: result.rows.map((row) => ({
        orderId: row.ORDER_ID,
        orderStatus: row.ORDER_STATUS,
        totalNestCoins: row.TOTAL_NEST_COINS,
        createdAt: row.CREATED_AT,
        studentName: row.STUDENT_NAME,
        deliveryStatus: row.DELIVERY_STATUS,
        deliveredAt: row.DELIVERED_AT,
        previewImage: row.PREVIEW_IMAGE,
        itemsSummary: row.ITEMS_SUMMARY
      }))
    });
  } catch (error) {
    res.status(500).json({ message: "Delivery history fetch failed.", error: error.message });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.put("/order/status", async (req, res, next) => {
  if (!ensureDeliveryPartner(req, res)) {
    return next();
  }

  const { orderId, status } = req.body;
  const deliveryPartnerId = req.user.ID || req.user.id;

  if (!orderId || !status) {
    return res.status(400).json({ message: "orderId and status are required." });
  }

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      message: `Invalid status. Allowed: ${allowedStatuses.join(", ")}.`
    });
  }

  let connection;

  try {
    connection = await getConnection();

    const assignment = await connection.execute(
      `SELECT order_id
       FROM delivery_assignments
       WHERE order_id = :order_id
       AND delivery_partner_id = :delivery_partner_id`,
      {
        order_id: orderId,
        delivery_partner_id: deliveryPartnerId
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (assignment.rows.length === 0) {
      return res.status(404).json({
        message: "Order assignment not found for this delivery partner."
      });
    }

    let timestampColumnUpdate = "";
    if (status === "Out for Delivery") {
      timestampColumnUpdate = ", picked_up_at = CURRENT_TIMESTAMP, on_the_way_at = CURRENT_TIMESTAMP";
    } else if (status === "Delivered") {
      timestampColumnUpdate = ", delivered_at = CURRENT_TIMESTAMP";
    }

    await connection.execute(
      `UPDATE delivery_assignments
       SET delivery_status = :status
       ${timestampColumnUpdate}
       WHERE order_id = :order_id
       AND delivery_partner_id = :delivery_partner_id`,
      {
        status,
        order_id: orderId,
        delivery_partner_id: deliveryPartnerId
      }
    );

    await connection.execute(
      `UPDATE orders
       SET status = :status
       WHERE id = :order_id`,
      {
        status,
        order_id: orderId
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

    if (status === "Delivered") {
      const payoutLookup = await connection.execute(
        `SELECT o.id, o.total_nest_coins, o.cook_id, o.payout_distributed, da.delivery_partner_id
         FROM orders o
         LEFT JOIN delivery_assignments da ON da.order_id = o.id
         WHERE o.id = :order_id`,
        { order_id: orderId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const order = payoutLookup.rows[0];
      if (!order.PAYOUT_DISTRIBUTED) {
        const payout = computeDeliveryPayout(order.TOTAL_NEST_COINS);

        if (order.COOK_ID) {
          await connection.execute(
            `UPDATE users SET nest_coins = nest_coins + :reward WHERE id = :id`,
            { reward: payout.cookShare, id: order.COOK_ID }
          );
        }

        if (order.DELIVERY_PARTNER_ID) {
          await connection.execute(
            `UPDATE users SET nest_coins = nest_coins + :reward WHERE id = :id`,
            { reward: payout.deliveryShare, id: order.DELIVERY_PARTNER_ID }
          );
        }

        await connection.execute(
          `UPDATE orders SET payout_distributed = 1 WHERE id = :order_id`,
          { order_id: orderId }
        );
      }
    }

    await connection.commit();
    res.json({ message: "Delivery status updated.", orderId, status });
  } catch (error) {
    res.status(500).json({ message: "Failed to update delivery status.", error: error.message });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

module.exports = router;
