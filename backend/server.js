const cors = require("cors");
const express = require("express");
const authRoutes = require("./routes/auth");
const cookRoutes = require("./routes/cook");
const deliveryRoutes = require("./routes/delivery");
const studentRoutes = require("./routes/student");

const app = express();

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/student", studentRoutes);
app.use("/api", cookRoutes);
app.use("/api", deliveryRoutes);

app.get("/", (_req, res) => {
  res.json({ app: "Foodnest Backend with Oracle SQL" });
});

module.exports = app;
