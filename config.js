/**
 * Bot Configuration
 * All permissions are ID-based, not role-based
 */

export const config = {
  // Server Lock - Bot only works in this server
  allowedGuildId: '1434124929879773197', // CHANGE THIS to your server ID
  
  // Point Managers - Can add/remove points for others
  pointManagers: [
    '937194748618354708',
    '1232261529752178719', // Point Manager 1
    '1450450293547339808', // Point Manager 2
  ],

  // Super Admins - Full access including emergency overrides
  superAdmins: [
    '937194748618354708',
    '1306580945419370621', // Super Admin 1
    //'937194748618354708',  // Super Admin 2
  ],

  // Points System Settings
  points: {
    allowSelfAdd: false, // Can point managers add points to themselves?
    allowNegativeBalance: false, // Can users have negative points? (SINGLE SOURCE OF TRUTH)
    minAmount: 1, // Minimum points per transaction
    maxAmount: 10000, // Maximum points per transaction
  },

  // Feature Flags
  features: {
    dmHistoryOnly: true, // History must be sent via DM
    requireAuditLog: true, // All actions must be logged
  },
};

/**
 * Check if command is being used in the allowed server
 * @param {string} guildId - Guild ID from interaction
 * @returns {boolean} True if allowed, false otherwise
 */
export function isAllowedServer(guildId) {
  return guildId === config.allowedGuildId;
}

/**
 * Check if user is a Point Manager
 */
export function isPointManager(userId) {
  return config.pointManagers.includes(userId) || isSuperAdmin(userId);
}

/**
 * Check if user is a Super Admin
 */
export function isSuperAdmin(userId) {
  return config.superAdmins.includes(userId);
}

/**
 * Check if user has permission to manage points for target
 */
export function canManagePoints(userId, targetUserId) {
  // Super admins can manage anyone
  if (isSuperAdmin(userId)) return true;

  // Point managers can manage others (unless self-add is disabled)
  if (isPointManager(userId)) {
    if (userId === targetUserId) {
      return config.points.allowSelfAdd;
    }
    return true;
  }

  return false;
}

/**
 * Check if user can view another user's history
 */
export function canViewHistory(userId, targetUserId) {
  // Users can always view their own history
  if (userId === targetUserId) return true;

  // Admins can view anyone's history
  return isPointManager(userId) || isSuperAdmin(userId);
}
