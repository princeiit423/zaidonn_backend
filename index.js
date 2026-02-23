require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session"); // ✅ ADD THIS
const connectDB = require("./config/db");
const registerRoutes = require("./routes/routes");

const app = express();

connectDB();

app.use(cors());
// 🔥 SESSION MIDDLEWARE ADD KARO (MOST IMPORTANT)
app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,     // production HTTPS ke liye
      httpOnly: true,
      sameSite: "none", // cross-origin ke liye required
    },
  })
);

app.use(express.json());

async function startServer() {
  await registerRoutes(app);   // 👈 CORRECT WAY

  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();