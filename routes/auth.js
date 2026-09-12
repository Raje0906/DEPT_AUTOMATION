const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db/pool');
const { logAudit } = require('../middleware/auditLogger');

const router = express.Router();

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      logAudit({
        req,
        tableName: 'users',
        action: 'LOGIN_FAILED',
        reason: 'Missing identifier or password',
      });
      return res.status(400).json({ error: 'Email/ID and password are required' });
    }

    const trimmed = identifier.trim();
    const lower = trimmed.toLowerCase();

    // 1. Try to find by email first (case-insensitive)
    let userResult = await pool.query(
      `SELECT u.id, u.name, u.role, u.email, u.password_hash, u.department, u.is_active
       FROM users u WHERE LOWER(u.email) = $1`,
      [lower]
    );

    // 2. If not found by email, try student roll_no / enrollment_no / roll aliases
    if (userResult.rows.length === 0) {
      const emailMatch = lower.match(/^(?:ce6a|student)(\d+)@meswadiacoe\.edu$/);
      let parsedRoll = null;
      if (emailMatch) {
        parsedRoll = String(parseInt(emailMatch[1], 10));
      } else {
        const rollMatch = lower.match(/^(?:ce6a)?0*(\d+)$/);
        if (rollMatch) {
          parsedRoll = String(parseInt(rollMatch[1], 10));
        }
      }

      userResult = await pool.query(
        `SELECT u.id, u.name, u.role, u.email, u.password_hash, u.department, u.is_active
         FROM users u
         JOIN students s ON s.user_id = u.id
         WHERE LOWER(s.roll_no) = $1 
            OR LOWER(s.enrollment_no) = $1
            OR ($2::text IS NOT NULL AND (
                s.roll_no = $2 
                OR s.roll_no = LPAD($2, 3, '0') 
                OR LOWER(s.roll_no) = 'ce6a' || LPAD($2, 3, '0')
            ))`,
        [lower, parsedRoll]
      );
    }

    // 3. Try faculty employee_id (case-insensitive)
    if (userResult.rows.length === 0) {
      userResult = await pool.query(
        `SELECT u.id, u.name, u.role, u.email, u.password_hash, u.department, u.is_active
         FROM users u
         JOIN faculty f ON f.user_id = u.id
         WHERE LOWER(f.employee_id) = $1`,
        [lower]
      );
    }

    if (userResult.rows.length === 0) {
      logAudit({
        req,
        tableName: 'users',
        action: 'LOGIN_FAILED',
        reason: `Login attempt for non-existent identifier: "${trimmed.slice(0, 50)}"`,
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      logAudit({
        req,
        tableName: 'users',
        recordId: user.id,
        changedBy: user.id,
        action: 'LOGIN_BLOCKED',
        reason: `Login blocked: inactive account (${user.email})`,
      });
      return res.status(403).json({ error: 'Account is inactive. Contact administration.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      logAudit({
        req,
        tableName: 'users',
        recordId: user.id,
        changedBy: user.id,
        action: 'LOGIN_FAILED',
        reason: `Invalid password attempt for user: ${user.email}`,
      });
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

    logAudit({
      req,
      tableName: 'users',
      recordId: user.id,
      changedBy: user.id,
      action: 'LOGIN_SUCCESS',
      newValue: { role: user.role, email: user.email },
      reason: `Successful login as ${user.role} (${user.email})`,
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

    logAudit({
      req,
      tableName: 'password_reset_tokens',
      recordId: user.id,
      changedBy: user.id,
      action: 'PASSWORD_RESET_REQUEST',
      reason: `Password reset requested for ${user.email}`,
    });

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

    logAudit({
      req,
      tableName: 'users',
      recordId: userId,
      changedBy: userId,
      action: 'PASSWORD_RESET_SUCCESS',
      reason: `Password successfully reset for user id: ${userId}`,
    });

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

// ─── POST /api/auth/register-student ─────────────────────────────────────────
router.post('/register-student', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      name,
      email,
      password,
      roll_no,
      enrollment_no,
      current_semester,
      batch,
      division,
      class_year,
    } = req.body;

    // Validation
    if (!name || !email || !password || !roll_no || !enrollment_no || !current_semester || !batch || !division) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanRoll = roll_no.trim().toUpperCase();
    const cleanEnroll = enrollment_no.trim().toUpperCase();
    const cleanClassYear = (class_year || 'TE').trim().toUpperCase();
    const semesterInt = parseInt(current_semester, 10);

    if (isNaN(semesterInt) || semesterInt < 1 || semesterInt > 8) {
      return res.status(400).json({ error: 'Semester must be a number between 1 and 8.' });
    }

    // Check duplicate email
    const emailCheck = await client.query('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // Check duplicate roll_no or enrollment_no
    const studentCheck = await client.query(
      'SELECT id, roll_no, enrollment_no FROM students WHERE LOWER(roll_no) = $1 OR LOWER(enrollment_no) = $2',
      [cleanRoll.toLowerCase(), cleanEnroll.toLowerCase()]
    );
    if (studentCheck.rows.length > 0) {
      const match = studentCheck.rows[0];
      if (match.roll_no.toLowerCase() === cleanRoll.toLowerCase()) {
        return res.status(400).json({ error: 'A student with this Roll Number is already registered.' });
      }
      return res.status(400).json({ error: 'A student with this PRN / Enrollment Number is already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const department = 'Computer Engineering';

    await client.query('BEGIN');

    const userRes = await client.query(
      `INSERT INTO users (name, role, email, password_hash, department)
       VALUES ($1, 'student', $2, $3, $4)
       RETURNING id`,
      [name.trim(), cleanEmail, passwordHash, department]
    );

    const userId = userRes.rows[0].id;

    await client.query(
      `INSERT INTO students (user_id, roll_no, enrollment_no, batch, current_semester, division, class_year)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, cleanRoll, cleanEnroll, batch.trim(), semesterInt, division.trim(), cleanClassYear]
    );

    await client.query('COMMIT');

    logAudit({
      req,
      tableName: 'students',
      recordId: userId,
      changedBy: userId,
      action: 'STUDENT_REGISTER',
      newValue: { email: cleanEmail, roll_no: cleanRoll, enrollment_no: cleanEnroll },
      reason: `Student self-registered: ${name.trim()} (${cleanRoll})`,
    });

    res.status(201).json({
      message: 'Student registered successfully. You can now log in.',
      email: cleanEmail,
      roll_no: cleanRoll,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Auth] Student registration error:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  } finally {
    client.release();
  }
});

// ─── POST /api/auth/register-faculty ─────────────────────────────────────────
router.post('/register-faculty', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      name,
      email,
      employee_id,
      designation,
      password,
      passcode,
    } = req.body;

    if (!name || !email || !employee_id || !designation || !password || !passcode) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const validPasscode = process.env.FACULTY_SECRET_KEY || 'COMP-FACULTY-2026';
    if (passcode.trim() !== validPasscode.trim()) {
      logAudit({
        req,
        tableName: 'faculty',
        action: 'SECURITY_ALERT',
        reason: `Failed faculty registration attempt with invalid passcode for email: ${email}`,
      });
      return res.status(403).json({ error: 'Invalid Department Staff Passcode. Access denied.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanEmpId = employee_id.trim().toUpperCase();

    // Check duplicate email
    const emailCheck = await client.query('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // Check duplicate employee_id
    const empCheck = await client.query('SELECT id FROM faculty WHERE LOWER(employee_id) = $1', [cleanEmpId.toLowerCase()]);
    if (empCheck.rows.length > 0) {
      return res.status(400).json({ error: 'A faculty member with this Employee ID is already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const department = 'Computer Engineering';

    await client.query('BEGIN');

    const userRes = await client.query(
      `INSERT INTO users (name, role, email, password_hash, department)
       VALUES ($1, 'faculty', $2, $3, $4)
       RETURNING id`,
      [name.trim(), cleanEmail, passwordHash, department]
    );

    const userId = userRes.rows[0].id;

    await client.query(
      `INSERT INTO faculty (user_id, department, designation, employee_id)
       VALUES ($1, $2, $3, $4)`,
      [userId, department, designation.trim(), cleanEmpId]
    );

    await client.query('COMMIT');

    logAudit({
      req,
      tableName: 'faculty',
      recordId: userId,
      changedBy: userId,
      action: 'FACULTY_REGISTER',
      newValue: { email: cleanEmail, employee_id: cleanEmpId, designation: designation.trim() },
      reason: `Faculty self-registered: ${name.trim()} (${cleanEmpId})`,
    });

    res.status(201).json({
      message: 'Faculty registered successfully. You can now log in.',
      email: cleanEmail,
      employee_id: cleanEmpId,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Auth] Faculty registration error:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  } finally {
    client.release();
  }
});

module.exports = router;

