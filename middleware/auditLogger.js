const pool = require('../db/pool');

/**
 * Logs a mark mutation to the audit_log table.
 * Call after any INSERT/UPDATE/DELETE on the marks table.
 */
async function auditMark({ recordId, changedBy, oldValue, newValue, action, reason }) {
  try {
    await pool.query(
      `INSERT INTO audit_log (table_name, record_id, changed_by, old_value, new_value, action, reason)
       VALUES ('marks', $1, $2, $3, $4, $5, $6)`,
      [recordId, changedBy, JSON.stringify(oldValue), JSON.stringify(newValue), action, reason || null]
    );
  } catch (err) {
    // Audit failures must not block the main request
    console.error('[Audit] Failed to write audit log:', err.message);
  }
}

/**
 * Generic audit logger for any table
 */
async function auditRecord({ tableName, recordId, changedBy, oldValue, newValue, action, reason }) {
  try {
    await pool.query(
      `INSERT INTO audit_log (table_name, record_id, changed_by, old_value, new_value, action, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tableName, recordId, changedBy, JSON.stringify(oldValue), JSON.stringify(newValue), action, reason || null]
    );
  } catch (err) {
    console.error('[Audit] Failed to write audit log:', err.message);
  }
}

module.exports = { auditMark, auditRecord };
