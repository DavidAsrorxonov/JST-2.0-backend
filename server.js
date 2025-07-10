import express from "express";
import pool from "./db.js";
import authRoutes from "./routes/authRoutes.js";
import photoUpload from "./routes/photoUpload.js";
import jobRoutes from "./routes/jobRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import todoRoutes from "./routes/todoRoutes.js";
import archivedToDoRoutes from "./routes/archivedToDoRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import cors from "cors";
import { tokenChecker } from "./middleware/tokenChecker.js";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.send("The server is running");
});

app.use("/auth", authRoutes);
app.use("/uploads", photoUpload);
app.use("/api", jobRoutes);
app.use("/api", eventRoutes);
app.use("/api", todoRoutes);
app.use("/api/archive", archivedToDoRoutes);
app.use("/api/users", userRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
