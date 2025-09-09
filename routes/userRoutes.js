import express from "express";
import pool from "../db.js";
import bcrypt from "bcrypt";
import { tokenChecker } from "../middleware/tokenChecker.js";

const router = express.Router();

const failedAttempts = new Map();

router.get("/users", (req, res) => {
  return res.json({ message: "API has been hit" });
});

router.delete("/users", tokenChecker, async (req, res) => {
  const userId = req.user.id;
  const { email, password } = req.body;

  if (!failedAttempts.has(userId)) {
    failedAttempts.set(userId, 0);
  }

  if (!email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const userResult = await pool.query(
      `SELECT email, user_password FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rowCount === 0) {
      const count = failedAttempts.get(userId) + 1;
      failedAttempts.set(userId, count);

      if (count >= 3) {
        failedAttempts.delete(userId);
        return res.status(440).json({ message: "Too many failed attempts" });
      }

      return res.status(404).json({ message: "User not found" });
    }

    const user = userResult.rows[0];

    if (user.email !== email) {
      const count = failedAttempts.get(userId) + 1;
      failedAttempts.set(userId, count);

      if (count >= 3) {
        failedAttempts.delete(userId);
        return res.status(440).json({ message: "Too many failed attempts" });
      }

      return res.status(400).json({ message: "Email does not match" });
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.user_password
    );

    if (!isPasswordCorrect) {
      const count = failedAttempts.get(userId) + 1;
      failedAttempts.set(userId, count);

      if (count >= 3) {
        failedAttempts.delete(userId);
        return res.status(440).json({ message: "Too many failed attempts" });
      }

      return res.status(401).json({ message: "Password does not match" });
    }

    failedAttempts.delete(userId);

    const deletedUser = await pool.query(
      `DELETE FROM users WHERE id = $1 RETURNING *`,
      [userId]
    );

    res.status(200).json({
      message: "User deleted successfully",
      user: deletedUser.rows[0],
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error deleting user" });
  }

  res.status(200).json({ message: "User deleted successfully" });
});

export default router;
