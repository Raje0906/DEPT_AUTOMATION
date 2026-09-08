const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db/pool');

const router = express.Router();

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/ID and password are required' });
    }

    // Try to find by email first, then by roll_no/enrollment_no/employee_id
    let userResult = await pool.query(
      `SELECT u.id, u.name, u.role, u.email, u.password_hash, u.department, u.is_active
       FROM users u WHERE u.email = $1`,
      [identifier.toLowerCase().trim()]
    );

    // If not found by email, try student roll_no / enrollment_no
    if (userResult.rows.length === 0) {
      userResult = await pool.query(
        `SELECT u.id, u.name, u.role, u.email, u.password_hash, u.department, u.is_active
         FROM users u
         JOIN students s ON s.user_id = u.id
         WHERE s.roll_no = $1 OR s.enrollment_no = $1`,
        [identifier.trim()]
      );
    }

    // Try faculty employee_id
    if (userResult.rows.length === 0) {
      userResult = await pool.query(
        `SELECT u.id, u.name, u.role, u.email, u.password_hash, u.department, u.is_active
         FROM users u
         JOIN faculty f ON f.user_id = u.id
         WHERE f.employee_id = $1`,
        [identifier.trim()]
      );
    }

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is inactive. Contact administration.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Fetch role-specific data for the token
    let roleData = {};
    if (user.role === 'student') {
      const s = await pool.query(
        `SELECT roll_no, enrollment_no, batch, current_semester, division FROM students WHERE user_id = $1`,
        [user.id]
      );
      roleData = s.rows[0] || {};
    } else if (user.role === 'faculty' || user.role === 'hod') {
      const f = await pool.query(
        `SELECT employee_id, designation FROM faculty WHERE user_id = $1`,
        [user.id]
      );
      roleData = f.rows[0] || {};
    }

    const payload = {
      id: user.id,
      name: user.name,
      role: user.role,
      dept: user.department,
      email: user.email,
      ...roleData,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        department: user.department,
        email: user.email,
        ...roleData,
      },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const userResult = await pool.query(
      `SELECT id, name, email FROM users WHERE email = $1 AND is_active = TRUE`,
      [email.toLowerCase().trim()]
    );

    // Always respond with success to prevent email enumeration
    res.json({ message: 'If that email exists, a reset link has been sent.' });

    if (userResult.rows.length === 0) return;

    const user = userResult.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    // Email sending (only if SMTP is configured)
    if (process.env.SMTP_USER) {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10),
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}&id=${user.id}`;
      await transporter.sendMail({
        from: `"GP College Result System" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: 'Password Reset — GP College Result System',
        html: `<p>Hi ${user.name},</p>
               <p>Click the link below to reset your password. This link expires in 1 hour.</p>
               <p><a href="${resetUrl}">${resetUrl}</a></p>
               <p>If you did not request this, ignore this email.</p>`,
      });
    } else {
      console.log(`[Auth] Password reset token for ${user.email}: ${resetToken}`);
    }
  } catch (err) {
    console.error('[Auth] Forgot password error:', err.message);
  }
});

// ─── POST /api/auth/reset-password ────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { userId, token, newPassword } = req.body;
    if (!userId || !token || !newPassword) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenResult = await pool.query(
      `SELECT id FROM password_reset_tokens
       WHERE user_id = $1 AND token_hash = $2 AND used = FALSE AND expires_at > NOW()`,
      [userId, tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, userId]);
    await pool.query(
      `UPDATE password_reset_tokens SET used = TRUE WHERE id = $1`,
      [tokenResult.rows[0].id]
    );

    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    console.error('[Auth] Reset password error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
const { verifyToken } = require('../middleware/auth');
router.get('/me', verifyToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT id, name, role, email, department FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: userResult.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
