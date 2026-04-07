const cors = require("cors");
const express = require("express");
const path = require("path");
const authRoutes = require("./routes/auth");
const cookRoutes = require("./routes/cook");
const deliveryRoutes = require("./routes/delivery");
const studentRoutes = require("./routes/student");

const app = express();
const frontendDir = path.join(__dirname, "..", "FrontEnd");

app.use(cors());
app.use(express.json());
app.use(express.static(frontendDir));

app.use("/api/auth", authRoutes);
app.use("/api/student", studentRoutes);
app.use("/api", cookRoutes);
app.use("/api", deliveryRoutes);

app.get("/", (_req, res) => {
  res.sendFile(path.join(frontendDir, "Userlogin.html"));
});

module.exports = app;
