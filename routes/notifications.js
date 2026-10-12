const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const whatsappService = require('../services/whatsappService');

// ─── GET /api/notifications/whatsapp/status ──────────────────────────────────
router.get('/whatsapp/status', verifyToken, (req, res) => {
  const status = whatsappService.getStatus();
  res.json({ success: true, ...status });
});

// ─── GET /api/notifications/whatsapp/students ────────────────────────────────
router.get('/whatsapp/students', verifyToken, requireRole('hod', 'faculty'), async (req, res) => {
  try {
    const pool = require('../db/pool');
    const result = await pool.query(`
      SELECT s.enrollment_no, s.roll_no, s.division, s.mobile, u.name, u.email
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE UPPER(s.enrollment_no) IN ('F23112050', 'F23112035', 'F23112061', 'F23112151')
      ORDER BY s.enrollment_no
    `);
    res.json({ success: true, students: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/notifications/whatsapp/init ────────────────────────────────────
// Initializes / reconnects the Baileys client
router.post('/whatsapp/init', verifyToken, requireRole('hod', 'faculty'), async (req, res) => {
  try {
    const result = await whatsappService.initWhatsApp({ printTerminalQr: true });
    res.json({ success: true, message: 'WhatsApp initialized', ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/notifications/whatsapp/send-test ───────────────────────────────
// Send a test WhatsApp message to one of the 4 whitelisted students
router.post('/whatsapp/send-test', verifyToken, requireRole('hod', 'faculty'), async (req, res) => {
  const { enrollment_no, message } = req.body;
  if (!enrollment_no) {
    return res.status(400).json({ error: 'enrollment_no is required.' });
  }

  const defaultMsg = message || `Hello! This is an automated test notification from the Department Automation System.`;
  const result = await whatsappService.sendStudentNotification(enrollment_no, defaultMsg);
  
  if (!result.success) {
    return res.status(result.blocked ? 403 : 500).json(result);
  }
  res.json(result);
});

// ─── POST /api/notifications/whatsapp/send-defaulter ──────────────────────────
// Send defaulter alert to a whitelisted student
router.post('/whatsapp/send-defaulter', verifyToken, requireRole('hod', 'faculty'), async (req, res) => {
  const { enrollment_no, overallPercentage, shortfalls } = req.body;
  if (!enrollment_no || overallPercentage === undefined) {
    return res.status(400).json({ error: 'enrollment_no and overallPercentage are required.' });
  }

  const result = await whatsappService.sendDefaulterAlert({
    enrollmentNo: enrollment_no,
    overallPercentage,
    shortfalls: shortfalls || [],
  });

  if (!result.success) {
    return res.status(result.blocked ? 403 : 500).json(result);
  }
  res.json(result);
});

// ─── POST /api/notifications/whatsapp/send-result ─────────────────────────────
// Send semester result alert to a whitelisted student
router.post('/whatsapp/send-result', verifyToken, requireRole('hod', 'faculty'), async (req, res) => {
  const { enrollment_no, semester, sgpa, resultStatus } = req.body;
  if (!enrollment_no || !semester) {
    return res.status(400).json({ error: 'enrollment_no and semester are required.' });
  }

  const result = await whatsappService.sendResultAlert({
    enrollmentNo: enrollment_no,
    semester,
    sgpa,
    resultStatus,
  });

  if (!result.success) {
    return res.status(result.blocked ? 403 : 500).json(result);
  }
  res.json(result);
});

// ─── POST /api/notifications/whatsapp/broadcast ───────────────────────────────
// Send announcement notice to all 4 whitelisted students
router.post('/whatsapp/broadcast', verifyToken, requireRole('hod'), async (req, res) => {
  const { title, message } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: 'title and message are required.' });
  }

  const results = await whatsappService.sendBroadcastNotice({
    title,
    message,
    authorName: req.user.name || 'HOD Office',
  });

  res.json({ success: true, count: results.length, results });
});

module.exports = router;
