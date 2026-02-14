const { AuditLog } = require("../models");

/**
 * Log an activity to the database
 * @param {Object} req - Express request object (to extract user and IP)
 * @param {String} action - Action name (e.g., 'LOGIN', 'CREATE_CASE')
 * @param {String} entityType - Type of entity affected (e.g., 'User', 'Case')
 * @param {String|Number} entityId - ID of entity affected
 * @param {String} details - Additional details
 */
async function logActivity(
  req,
  action,
  entityType = null,
  entityId = null,
  details = null,
) {
  try {
    const userId = req.session?.userId || null;
    let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // Clean IP if it's ::1 (localhost)
    if (ip === "::1") ip = "127.0.0.1";

    await AuditLog.create({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      details,
      ip_address: ip,
    });
  } catch (error) {
    console.error("Audit Log Error:", error);
    // Don't throw, we don't want logging failure to break the app
  }
}

module.exports = { logActivity };
