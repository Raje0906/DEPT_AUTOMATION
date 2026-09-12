const fs = require('fs');
const path = require('path');
const pool = require('../db/pool');

const LOGS_DIR = path.join(__dirname, '../logs');

// Ensure the logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  } catch (err) {
    console.error('[Audit] Failed to create logs directory:', err.message);
  }
}

/**
 * Extracts client IP address from incoming Express request.
 * Handles proxies/load balancers (x-forwarded-for) as well as direct sockets.
 */
function extractIp(req) {
  if (!req) return null;
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return req.socket?.remoteAddress || req.ip || null;
}

/**
 * Core dual-layer audit logger:
 * 1. Inserts into PostgreSQL `audit_log` table (live querying & alerts)
 * 2. Appends JSON record to daily server log file `logs/audit-YYYY-MM-DD.log` (tamper-evident backup)
 */
async function logAudit({
  req = null,
  tableName = 'system',
  recordId = null,
  changedBy = null,
  action,
  oldValue = null,
  newValue = null,
  reason = null,
  ip = null,
  userAgent = null,
}) {
  const clientIp = ip || extractIp(req);
  const clientUserAgent = userAgent || (req ? req.headers['user-agent'] : null);
  const effectiveUserId = changedBy !== undefined && changedBy !== null ? changedBy : (req?.user?.id || null);

  // 1. Write to PostgreSQL audit_log table
  try {
    await pool.query(
      `INSERT INTO audit_log (table_name, record_id, changed_by, old_value, new_value, action, reason, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tableName,
        recordId || null,
        effectiveUserId,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        action,
        reason || null,
        clientIp || null,
        clientUserAgent ? clientUserAgent.slice(0, 500) : null,
      ]
    );
  } catch (err) {
    console.error('[Audit:DB] Failed to insert audit log entry:', err.message);
  }

  // 2. Append to local daily audit log file
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const logFilePath = path.join(LOGS_DIR, `audit-${today}.log`);
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      tableName,
      recordId: recordId || null,
      changedBy: effectiveUserId,
      ip: clientIp || 'UNKNOWN',
      userAgent: clientUserAgent || 'UNKNOWN',
      reason: reason || null,
      oldValue: oldValue || null,
      newValue: newValue || null,
    };
    await fs.promises.appendFile(logFilePath, JSON.stringify(logEntry) + '\n', 'utf8');
  } catch (err) {
    console.error('[Audit:File] Failed to append to audit log file:', err.message);
  }
}

/**
 * Legacy wrapper: Logs mark mutations to audit_log table and log file.
 */
async function auditMark({ req, recordId, changedBy, oldValue, newValue, action, reason }) {
  return logAudit({
    req,
    tableName: 'marks',
    recordId,
    changedBy,
    oldValue,
    newValue,
    action,
    reason,
  });
}

/**
 * Legacy wrapper: Generic audit logger for table records.
 */
async function auditRecord({ req, tableName, recordId, changedBy, oldValue, newValue, action, reason }) {
  return logAudit({
    req,
    tableName,
    recordId,
    changedBy,
    oldValue,
    newValue,
    action,
    reason,
  });
}

module.exports = {
  logAudit,
  auditMark,
  auditRecord,
  extractIp,
};
