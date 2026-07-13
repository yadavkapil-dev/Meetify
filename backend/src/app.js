import express from "express";
import { createServer } from "node:http";
import { connectToServer } from "./controllers/socketManager.js";
import mongoose from "mongoose";
import cors from "cors";
import userRoutes from "./routes/users.routes.js";
import dotenv from "dotenv";
import { getCorsWhitelist, buildCorsOriginCheck } from "./utils/cors.js";

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);

// Initialize Socket.IO via your socketManager
const io = connectToServer(server);

// Use port from .env or default to 8000
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors({ origin: buildCorsOriginCheck(getCorsWhitelist()) }));
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

// Routes
app.use("/api/v1/users", userRoutes);

// 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

// Centralized error handler — never leak raw error details to the client
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.status === 403 ? "Origin not allowed" : "Something went wrong. Please try again.",
  });
});

// Start server and connect to MongoDB
const start = async () => {
  try {
    const connectionDB = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${connectionDB.connection.host}`);

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
  }
};

start();
