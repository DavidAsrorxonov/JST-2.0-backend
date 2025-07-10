import express from "express";
import pool from "../db.js";
import { tokenChecker } from "../middleware/tokenChecker.js";

const router = express.Router();

router.get("/todos", tokenChecker, async (req, res) => {
  const { user_id } = req.query;

  const results = await pool.query(`SELECT * FROM todos WHERE user_id = $1`, [
    user_id,
  ]);

  res.json(results.rows);
});

router.post("/todos", tokenChecker, async (req, res) => {
  const {
    todo_title,
    todo_duetime,
    todo_priority,
    todo_status,
    todo_category,
    is_important,
    user_id,
  } = req.body;

  if (
    !todo_title ||
    !todo_duetime ||
    !todo_priority ||
    !todo_status ||
    !todo_category ||
    is_important === undefined
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const results = await pool.query(
      `INSERT INTO todos (todo_title, todo_duetime, todo_priority, todo_status, todo_category, is_important, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        todo_title,
        todo_duetime,
        todo_priority,
        todo_status,
        todo_category,
        is_important,
        user_id,
      ]
    );

    return res.status(201).json(results.rows[0]);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/todos/:id", tokenChecker, async (req, res) => {
  const todoId = req.params.id;

  try {
    const results = await pool.query(
      `DELETE FROM todos WHERE id = $1 RETURNING *`,
      [todoId]
    );

    if (results.rows.length === 0) {
      return res.status(404).json({ message: "Todo not found" });
    } else {
      return res.status(200).json(results.rows[0]);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
