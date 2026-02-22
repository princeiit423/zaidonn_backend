require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const registerRoutes = require("./routes/routes");

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

async function startServer() {
  await registerRoutes(app);   // 👈 CORRECT WAY

  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();