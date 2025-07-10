import express from "express";
import pool from "../db.js";
import { tokenChecker } from "../middleware/tokenChecker.js";

const router = express.Router();

router.get("/events", tokenChecker, async (req, res) => {
  const { user_id } = req.query;

  const results = await pool.query(`SELECT * FROM events WHERE user_id = $1`, [
    user_id,
  ]);

  res.json(results.rows);
});

router.post("/events", tokenChecker, async (req, res) => {
  const { event_name, event_description, event_date, user_id } = req.body;

  if (!event_name || !event_description || !event_date || !user_id) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const results = await pool.query(
      `INSERT INTO events (event_name, event_description, event_date, user_id) VALUES ($1, $2, $3, $4) RETURNING *`,
      [event_name, event_description, event_date, user_id]
    );

    return res.status(201).json(results.rows[0]);
  } catch (error) {
    console.error("Error inserting event:", error);
    return res.status(500).json({ message: "Error inserting event" });
  }
});

export default router;
