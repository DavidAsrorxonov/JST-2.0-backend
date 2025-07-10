import express from "express";
import pool from "../db.js";
import { tokenChecker } from "../middleware/tokenChecker.js";

const router = express.Router();

router.get("/jobs", tokenChecker, async (req, res) => {
  const { user_id } = req.query;

  const results = await pool.query(`SELECT * FROM jobs WHERE user_id = $1`, [
    user_id,
  ]);

  res.json(results.rows);
});

router.post("/jobs", tokenChecker, async (req, res) => {
  const {
    job_title,
    company,
    applied_at,
    job_status,
    job_type,
    website_url,
    user_id,
  } = req.body;

  if (
    !job_title ||
    !company ||
    !applied_at ||
    !job_status ||
    !job_type ||
    !website_url ||
    !user_id
  ) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const results = await pool.query(
      `INSERT INTO jobs (job_title, company, applied_at, job_status, job_type, website_url, user_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        job_title,
        company,
        applied_at,
        job_status,
        job_type,
        website_url,
        user_id,
      ]
    );

    res.status(201).json(results.rows[0]);
  } catch (error) {
    console.error("Error inserting job:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/jobs/:id", tokenChecker, async (req, res) => {
  const jobId = req.params.id;
  const fields = req.body;

  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: "No fields provided" });
  }

  const setClause = Object.keys(fields)
    .map((field, index) => `${field} = $${index + 1}`)
    .join(", ");

  const values = Object.values(fields);

  try {
    const result = await pool.query(
      `UPDATE jobs SET ${setClause} WHERE id = $${
        values.length + 1
      } RETURNING *`,
      [...values, jobId]
    );
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error updating job:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/jobs/:id", tokenChecker, async (req, res) => {
  const jobId = req.params.id;

  try {
    const results = await pool.query(
      `DELETE FROM jobs WHERE id = $1 RETURNING *`,
      [jobId]
    );

    if (results.rows.length === 0) {
      res.status(404).json({ error: "Job not found" });
    } else {
      res.status(200).json(results.rows[0]);
    }
  } catch (error) {
    console.error("Error deleting job:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
