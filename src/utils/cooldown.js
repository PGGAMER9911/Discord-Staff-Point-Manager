/**
 * Rate Limiting / Cooldown System
 * Prevents command spam and database abuse
 */

// Store cooldowns: Map<userId, Map<commandName, timestamp>>
const cooldowns = new Map();

// Cooldown duration in milliseconds
const COOLDOWN_DURATION = 3000; // 3 seconds

/**
 * Check if user is on cooldown for a command
 * @param {string} userId - Discord user ID (as string)
 * @param {string} commandName - Command identifier (e.g., 'points_add', 'points_remove')
 * @returns {number} Remaining cooldown time in seconds (0 if no cooldown)
 */
export function checkCooldown(userId, commandName) {
  if (!cooldowns.has(userId)) {
    return 0;
  }

  const userCooldowns = cooldowns.get(userId);
  
  if (!userCooldowns.has(commandName)) {
    return 0;
  }

  const expirationTime = userCooldowns.get(commandName);
  const now = Date.now();

  if (now < expirationTime) {
    // Still on cooldown
    const remainingMs = expirationTime - now;
    return Math.ceil(remainingMs / 1000);
  }

  // Cooldown expired
  return 0;
}

/**
 * Set cooldown for user on specific command
 * @param {string} userId - Discord user ID (as string)
 * @param {string} commandName - Command identifier
 */
export function setCooldown(userId, commandName) {
  if (!cooldowns.has(userId)) {
    cooldowns.set(userId, new Map());
  }

  const userCooldowns = cooldowns.get(userId);
  const expirationTime = Date.now() + COOLDOWN_DURATION;
  
  userCooldowns.set(commandName, expirationTime);

  // Auto-cleanup after cooldown expires
  setTimeout(() => {
    const userCooldowns = cooldowns.get(userId);
    if (userCooldowns) {
      userCooldowns.delete(commandName);
      
      // Clean up user entry if no more cooldowns
      if (userCooldowns.size === 0) {
        cooldowns.delete(userId);
      }
    }
  }, COOLDOWN_DURATION);
}

/**
 * Clear all cooldowns (for testing or emergency)
 */
export function clearAllCooldowns() {
  cooldowns.clear();
}
