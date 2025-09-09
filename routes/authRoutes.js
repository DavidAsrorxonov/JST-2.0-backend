import express from "express";
import bcrypt from "bcrypt";
import pool from "../db.js";
import jwt from "jsonwebtoken";
import loginLimiter from "../middleware/loginLimiter.js";
import nodemailer from "nodemailer";
import { tokenChecker } from "../middleware/tokenChecker.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

const otpStore = new Map(); // store: email -> { otp, expiresAt }

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your Verification Code",
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Email Verification</h2>
        <p>Your verification code is:</p>
        <div style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 3px; margin: 20px 0;">
          ${otp}
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
      </div>
      `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
};

// Step 1: Send OTP to email
router.post("/register-send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Check if email already registered in DB
    const userExists = await pool.query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );
    if (userExists.rowCount > 0) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Generate OTP and expiry (10 minutes)
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    // Store OTP with expiry
    otpStore.set(email, { otp, expiresAt });

    // Send OTP email
    const sendEmail = await sendOTPEmail(email, otp);
    if (!sendEmail) {
      return res.status(500).json({ error: "Failed to send email" });
    }

    res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/verify-otp", (req, res) => {
  const { email, otpValue } = req.body;
  const storedOtp = otpStore.get(email);

  const realOTP = storedOtp.otp;
  otpValue.toString();

  if (realOTP === otpValue) {
    otpStore.delete(email);
    return res.status(200).json({ message: "OTP verified successfully" });
  }

  return res.status(400).json({ message: "Invalid OTP" });
});

// Step 2: Register with OTP verification
router.post("/register", async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // OTP valid, proceed with registration
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, email, user_password) VALUES ($1, $2, $3, $4) RETURNING *`,
      [firstName, lastName, email, hashedPassword]
    );

    // Clear OTP after successful registration
    otpStore.delete(email);

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "24h",
    });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
      },
      token,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Email is already registered" });
    }

    console.log(error);
    res.status(500).json({ message: "Error registering user" });
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  const email = req.body.email?.trim();
  const password = req.body.password;

  if (!email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [
      email,
    ]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.user_password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "24h",
    });

    res.status(200).json({
      message: "User logged in successfully",
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
      },
      token,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error logging in user" });
  }
});

router.post("/password-check", tokenChecker, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const oldPassword = await pool.query(
      `SELECT user_password FROM users WHERE email = $1`,
      [email]
    );

    const doesPasswordMatch = await bcrypt.compare(
      password,
      oldPassword.rows[0].user_password
    );

    if (doesPasswordMatch) {
      return res.status(200).json({ message: "Password matches" });
    } else {
      return res.status(400).json({ message: "Password does not match" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error checking password" });
  }
});

router.put("/password-update", tokenChecker, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const response = await pool.query(
      `UPDATE users SET user_password = $1 WHERE email = $2 RETURNING *`,
      [hashedPassword, email]
    );

    res.status(200).json({
      message: "Password updated successfully",
      user: {
        id: response.rows[0].id,
        firstName: response.rows[0].first_name,
        lastName: response.rows[0].last_name,
        email: response.rows[0].email,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error updating password" });
  }
});

export default router;
