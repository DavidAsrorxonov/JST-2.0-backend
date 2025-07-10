import express from "express";
import pool from "../db.js";
import { tokenChecker } from "../middleware/tokenChecker.js";

const router = express.Router();

router.get("/todos", tokenChecker, async (req, res) => {
  const { user_id } = req.query;

  const results = await pool.query(
    `SELECT * FROM archived_todos WHERE user_id = $1`,
    [user_id]
  );

  res.json(results.rows);
});

router.post("/todos/:id", tokenChecker, async (req, res) => {
  const todoId = req.params.id;

  try {
    const results = await pool.query(`SELECT * FROM todos WHERE id = $1`, [
      todoId,
    ]);
    const todo = results.rows[0];

    if (!todo) {
      return res.status(404).json({ message: "Todo not found" });
    }

    await pool.query(
      `INSERT INTO archived_todos (archived_todo_title, archived_todo_duetime, archived_todo_priority, archived_todo_status, archived_todo_category, archived_is_important, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        todo.todo_title,
        todo.todo_duetime,
        todo.todo_priority,
        todo.todo_status,
        todo.todo_category,
        todo.is_important,
        todo.user_id,
      ]
    );

    await pool.query(`DELETE FROM todos WHERE id = $1`, [todoId]);

    res.status(200).json({ message: "Todo archived successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/todos/:id", tokenChecker, async (req, res) => {
  const todoId = req.params.id;

  try {
    const results = await pool.query(
      `DELETE FROM archived_todos WHERE id = $1 RETURNING *`,
      [todoId]
    );

    if (results.rows.length === 0) {
      return res.status(404).json({ message: "Archived todo not found" });
    } else {
      return res.status(200).json(results.rows[0]);
    }
  } catch (error) {
    console.log("Error deleting archived todo:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
