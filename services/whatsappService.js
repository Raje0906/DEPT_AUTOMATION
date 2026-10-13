const path = require('path');
const fs = require('fs');
const pool = require('../db/pool');

// Directory to store session authentication tokens
const SESSION_DIR = path.join(__dirname, '..', 'data', 'whatsapp_session');
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// ─── STRICT TESTING WHITELIST ────────────────────────────────────────────────
// The user specified that notifications must ONLY be sent to these 4 students:
const ALLOWED_ENROLLMENTS = new Set([
  'F23112050', // RAJE ADITYA YOGESH
  'F23112035', // PAL NIHAR NIKHIL
  'F23112061', // HOLE ANSHU NITIN
  'F23112151', // SOHAM ATUL SHELKE
]);

// Known verified mobile numbers for the allowed students and faculty
const ALLOWED_PHONE_NUMBERS = new Set([
  '9699616876', // Aditya Raje
  '9970024032', // Aditya Raje (alternate)
  '9404241539', // Nihar Pal
  '8446016602', // Anshu Hole
  '9970024042', // Soham Shelke
  '8830673864', // Faculty CYV (Ms. C. Y. Vakte)
]);

// Allowed Faculty IDs for testing
const ALLOWED_FACULTY_IDS = new Set([
  'CYV', // Ms. C. Y. Vakte
]);

let sock = null;
let connectionState = 'DISCONNECTED'; // 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED'
let latestQr = null;
let connectedUser = null;
let reconnectTimer = null;

/**
 * Checks if a recipient is allowed under the current test whitelist
 */
function isAllowedRecipient({ enrollment_no, phone, employee_id }) {
  if (enrollment_no && ALLOWED_ENROLLMENTS.has(String(enrollment_no).trim().toUpperCase())) {
    return true;
  }
  if (employee_id && ALLOWED_FACULTY_IDS.has(String(employee_id).trim().toUpperCase())) {
    return true;
  }
  if (phone) {
    const clean = String(phone).replace(/\D/g, '').slice(-10);
    if (ALLOWED_PHONE_NUMBERS.has(clean)) {
      return true;
    }
  }
  return false;
}

/**
 * Clean phone number to 10 digits
 */
function cleanPhoneNumber(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? digits : null;
}

/**
 * Initialize Baileys WhatsApp Connection
 */
async function initWhatsApp(options = { printTerminalQr: true }) {
  if (connectionState === 'CONNECTING' || connectionState === 'CONNECTED') {
    return { status: connectionState, qr: latestQr };
  }

  try {
    connectionState = 'CONNECTING';

    const baileys = await import('@whiskeysockets/baileys');
    const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;
    const { Boom } = await import('@hapi/boom');
    const qrcode = (await import('qrcode-terminal')).default;
    const pino = (await import('pino')).default;

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    let version;
    try {
      const v = await fetchLatestBaileysVersion();
      version = v.version;
    } catch {
      version = [2, 3000, 1043857760];
    }

    console.log(`[WhatsApp] Connecting with Baileys v${version.join('.')}...`);

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['Ubuntu', 'Chrome', '120.0.0.0'],
    });

    sock.ev.on('creds.update', saveCreds);

    if (sock.ws) {
      sock.ws.on('error', (err) => {
        console.warn('[WhatsApp WS Error]', err.message);
      });
    }

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        latestQr = qr;
        connectionState = 'QR_READY';
        console.log('\n[WhatsApp] ═══════════════════════════════════════════════════════');
        console.log('[WhatsApp] SCAN THIS QR CODE ON YOUR PHONE TO LINK WHATSAPP:');
        console.log('[WhatsApp] ═══════════════════════════════════════════════════════\n');
        if (options.printTerminalQr) {
          qrcode.generate(qr, { small: true });
        }
      }

      if (connection === 'open') {
        connectionState = 'CONNECTED';
        latestQr = null;
        connectedUser = sock.user ? sock.user.id.split(':')[0] : 'Linked';
        console.log(`\n[WhatsApp] Connected successfully! Active account: ${connectedUser}`);
        console.log(`[WhatsApp] Whitelist active: ${Array.from(ALLOWED_ENROLLMENTS).join(', ')}\n`);
      }

      if (connection === 'close') {
        connectionState = 'DISCONNECTED';
        connectedUser = null;
        const statusCode = lastDisconnect?.error instanceof Boom 
          ? lastDisconnect.error.output?.statusCode 
          : null;

        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        console.warn(`[WhatsApp] Connection closed. (Reason: ${lastDisconnect?.error?.message || 'Unknown'})`);

        if (isLoggedOut) {
          console.warn('[WhatsApp] Session logged out. Removing invalid credentials to generate fresh QR...');
          try {
            const files = fs.readdirSync(SESSION_DIR);
            for (const file of files) {
              fs.unlinkSync(path.join(SESSION_DIR, file));
            }
          } catch (e) {
            console.error('[WhatsApp] Error clearing session folder:', e.message);
          }
        }

        // Auto-reconnect after 5 seconds if not already reconnecting
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          console.log('[WhatsApp] Attempting reconnection...');
          initWhatsApp(options);
        }, 5000);
      }
    });

    return { status: connectionState, qr: latestQr };
  } catch (err) {
    connectionState = 'DISCONNECTED';
    console.error('[WhatsApp Init Error]', err);
    throw err;
  }
}

/**
 * Returns current status and whitelist
 */
function getStatus() {
  return {
    connectionState,
    isConnected: connectionState === 'CONNECTED',
    hasQr: !!latestQr,
    qr: latestQr,
    connectedUser,
    whitelist: {
      enrollments: Array.from(ALLOWED_ENROLLMENTS),
      phones: Array.from(ALLOWED_PHONE_NUMBERS),
      faculty: Array.from(ALLOWED_FACULTY_IDS),
    },
  };
}

/**
 * Send raw WhatsApp text message with whitelist enforcement
 */
async function sendDirectMessage(phoneNumber, messageText) {
  const clean = cleanPhoneNumber(phoneNumber);
  if (!clean) {
    return { success: false, error: 'Invalid 10-digit phone number' };
  }

  // Whitelist check
  if (!ALLOWED_PHONE_NUMBERS.has(clean)) {
    console.warn(`[WhatsApp Blocked] Phone ${clean} is NOT in the test whitelist! Message cancelled.`);
    return {
      success: false,
      blocked: true,
      error: `Number ${clean} is outside the allowed test whitelist (${Array.from(ALLOWED_PHONE_NUMBERS).join(', ')})`,
    };
  }

  if (connectionState !== 'CONNECTED' || !sock) {
    return {
      success: false,
      error: 'WhatsApp is not connected yet. Please scan the QR code first.',
      status: connectionState,
    };
  }

  try {
    const jid = `91${clean}@s.whatsapp.net`;
    const result = await sock.sendMessage(jid, { text: messageText });
    console.log(`[WhatsApp Sent] Delivered to ${jid}`);
    return { success: true, messageId: result.key.id, to: clean };
  } catch (err) {
    console.error(`[WhatsApp Send Error] To: ${clean}`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send notification to a student by enrollment_no
 */
async function sendStudentNotification(enrollmentNo, messageText) {
  const normEnrollment = String(enrollmentNo).trim().toUpperCase();

  // Strict whitelist check
  if (!ALLOWED_ENROLLMENTS.has(normEnrollment)) {
    console.warn(`[WhatsApp Blocked] Enrollment ${normEnrollment} is NOT in the test whitelist!`);
    return {
      success: false,
      blocked: true,
      error: `Student ${normEnrollment} is outside the allowed test whitelist (${Array.from(ALLOWED_ENROLLMENTS).join(', ')})`,
    };
  }

  // Look up student contact in database
  const res = await pool.query(
    `SELECT s.enrollment_no, s.mobile, u.name 
     FROM students s 
     JOIN users u ON s.user_id = u.id 
     WHERE UPPER(s.enrollment_no) = $1`,
    [normEnrollment]
  );

  if (res.rows.length === 0) {
    return { success: false, error: `Student ${normEnrollment} not found in database.` };
  }

  const student = res.rows[0];
  const phone = cleanPhoneNumber(student.mobile);

  if (!phone) {
    return { success: false, error: `No valid mobile number configured for student ${student.name} (${normEnrollment}).` };
  }

  return sendDirectMessage(phone, messageText);
}

/**
 * Send Defaulter Notification (Attendance < 75%)
 */
async function sendDefaulterAlert({ enrollmentNo, overallPercentage, shortfalls = [], actionPlan = null }) {
  const norm = String(enrollmentNo).trim().toUpperCase();
  if (!ALLOWED_ENROLLMENTS.has(norm)) {
    return { success: false, blocked: true, error: `Student ${norm} is not in test whitelist.` };
  }

  const res = await pool.query(
    `SELECT s.enrollment_no, s.mobile, s.division, u.name 
     FROM students s 
     JOIN users u ON s.user_id = u.id 
     WHERE UPPER(s.enrollment_no) = $1`,
    [norm]
  );
  if (res.rows.length === 0) return { success: false, error: 'Student not found' };

  const student = res.rows[0];
  let shortfallText = '';
  if (Array.isArray(shortfalls) && shortfalls.length > 0) {
    shortfallText = '\n*Subject Breakdown:*\n' + shortfalls
      .map(s => `• ${s.code || s.name}: ${s.percentage}% (${s.attended}/${s.total})`)
      .join('\n');
  }

  const message = 
    `⚠️ *ATTENDANCE DEFAULTER ALERT — DEPT OF COMPUTER ENGG*\n\n` +
    `Dear *${student.name}* (${student.enrollment_no}, Div: ${student.division}),\n\n` +
    `Your overall monthly attendance stands at *${parseFloat(overallPercentage).toFixed(1)}%*, which is below the mandatory university threshold (*75.0%*).\n` +
    shortfallText + '\n\n' +
    `📋 *Remedial Action Required:*\n` +
    `Please meet your Class Teacher / Mentor to complete your compensatory worksheets and sign the formal undertaking.\n\n` +
    `— *HOD Office & Defaulter Monitoring Cell*`;

  return sendDirectMessage(student.mobile, message);
}

/**
 * Send Result Publication Notification
 */
async function sendResultAlert({ enrollmentNo, semester, sgpa, resultStatus }) {
  const norm = String(enrollmentNo).trim().toUpperCase();
  if (!ALLOWED_ENROLLMENTS.has(norm)) {
    return { success: false, blocked: true, error: `Student ${norm} is not in test whitelist.` };
  }

  const res = await pool.query(
    `SELECT s.enrollment_no, s.mobile, u.name 
     FROM students s 
     JOIN users u ON s.user_id = u.id 
     WHERE UPPER(s.enrollment_no) = $1`,
    [norm]
  );
  if (res.rows.length === 0) return { success: false, error: 'Student not found' };
  const student = res.rows[0];

  const message =
    `📢 *SEMESTER RESULT PUBLISHED — DEPT OF COMPUTER ENGG*\n\n` +
    `Dear *${student.name}* (${student.enrollment_no}),\n\n` +
    `Your Semester *${semester}* examination results are now published.\n\n` +
    `📊 *SGPA:* ${sgpa ? Number(sgpa).toFixed(2) : 'N/A'}\n` +
    `🏆 *Result Status:* ${resultStatus || 'PASSED'}\n\n` +
    `You can log in to the Department Automation Portal to view and download your detailed statement of marks.\n\n` +
    `— *Examination Coordinator & HOD*`;

  return sendDirectMessage(student.mobile, message);
}

/**
 * Send Broadcast Announcement (Delivers to whitelisted students & faculty)
 */
async function sendBroadcastNotice({ title = 'DEPARTMENT ALERT', message, authorName = 'Dr.(Mrs.) N. F. Shaikh' }) {
  const results = [];
  const enrollments = Array.from(ALLOWED_ENROLLMENTS);

  const text = message.includes('DEPARTMENT NOTICE:')
    ? message
    : `📢 *DEPARTMENT NOTICE: ${title.toUpperCase()}*\n\n` +
      `${message}\n\n` +
      `— *${authorName}*`;

  for (const enr of enrollments) {
    const res = await sendStudentNotification(enr, text);
    results.push({ enrollment_no: enr, ...res });
  }

  // Also deliver to whitelisted faculty CYV
  const cyvRes = await sendDirectMessage('8830673864', text);
  results.push({ enrollment_no: 'FACULTY_CYV', ...cyvRes });

  return results;
}

/**
 * Send notification to a faculty member by employee_id or initials
 */
async function sendFacultyNotification(employeeId, messageText) {
  const normId = String(employeeId).trim().toUpperCase();
  if (normId === 'CYV' || ALLOWED_FACULTY_IDS.has(normId)) {
    return sendDirectMessage('8830673864', messageText);
  }
  return { success: false, blocked: true, error: `Faculty ${normId} is not in test whitelist.` };
}

module.exports = {
  initWhatsApp,
  getStatus,
  sendDirectMessage,
  sendStudentNotification,
  sendFacultyNotification,
  sendDefaulterAlert,
  sendResultAlert,
  sendBroadcastNotice,
  ALLOWED_ENROLLMENTS,
  ALLOWED_PHONE_NUMBERS,
  ALLOWED_FACULTY_IDS,
};
