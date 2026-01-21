import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// ==========================================
// DATABASE SERVICE LAYER
// ==========================================
// This layer interfaces with the finalized PostgreSQL database via Supabase.
//
// CRITICAL ARCHITECTURE:
// - PostgreSQL function modify_points() is the SINGLE SOURCE OF TRUTH for point mutations
// - ALL add/remove operations MUST go through modify_points() RPC
// - NO direct UPDATE on staff_points table
// - NO direct INSERT into points_history table
// - Database handles: atomicity, locking, validation, history insertion
//
// SECURITY: Using service_role key for server-side operations only
// NEVER expose this key to client-side code
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Export supabase client for other services
export { supabase };

/**
 * Get user's current points
 * READ ONLY operation - safe to call anytime
 * @param {string} userId - Discord user ID (treated as string, never Number)
 * @returns {Promise<number>} Current points balance
 */
export async function getUserPoints(userId) {
  try {
    // CRITICAL: userId is kept as string to prevent BIGINT precision loss
    // Discord IDs are 18-digit snowflakes, JS Number is only accurate to 16 digits
    const { data, error } = await supabase
      .from('staff_points')
      .select('points')
      .eq('id', userId)  // Supabase handles string->BIGINT conversion safely
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // User not found in database, return 0 (they have no points yet)
        return 0;
      }
      throw error;
    }

    return data?.points || 0;
  } catch (error) {
    console.error('Error fetching user points:', error);
    throw new Error('Failed to fetch user points');
  }
}

/**
 * Add points to a user using ATOMIC TRANSACTION via modify_points() RPC
 * 
 * ARCHITECTURE:
 * - Calls PostgreSQL function modify_points()
 * - Database handles: row locking, validation, points update, history insert
 * - All operations are atomic (all succeed or all fail)
 * - NO direct database manipulation in JavaScript
 * 
 * @param {string} targetUserId - User receiving points (Discord ID as string)
 * @param {string} actionByUserId - User performing the action (Discord ID as string)
 * @param {number} amount - Points to add (must be positive)
 * @param {string|null} reason - Optional reason for transaction
 * @returns {Promise<{before: number, after: number}>}
 */
export async function addPoints(targetUserId, actionByUserId, amount, reason = null) {
  // CRITICAL: All Discord IDs remain as strings, never converted to Number
  // This prevents precision loss with 18-digit snowflake IDs
  
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  try {
    // Call PostgreSQL function modify_points() via Supabase RPC
    // This function is TESTED, VERIFIED, and the SINGLE SOURCE OF TRUTH
    // If ANY step fails inside the function, the ENTIRE transaction rolls back
    const { data, error } = await supabase.rpc('modify_points', {
      p_target_user_id: targetUserId,        // String safely converted to BIGINT by Postgres
      p_action_by_user_id: actionByUserId,   // String safely converted to BIGINT by Postgres
      p_action_type: 'ADD',
      p_amount: amount,
      p_allow_negative: false,  // Not relevant for ADD operations
      p_reason: reason,
    });

    if (error) {
      console.error('Database RPC error:', error);
      // Map database errors to user-friendly messages
      throw new Error(error.message || 'Failed to add points');
    }

    // Database returns JSON with before_points and after_points
    return {
      before: data.before_points,
      after: data.after_points,
    };
  } catch (error) {
    console.error('Error adding points:', error);
    // Re-throw with original error message (includes validation failures from DB)
    throw error;
  }
}

/**
 * Remove points from a user using ATOMIC TRANSACTION via modify_points() RPC
 * 
 * ARCHITECTURE:
 * - Calls PostgreSQL function modify_points()
 * - Database validates negative balance BEFORE any writes
 * - All operations are atomic (all succeed or all fail)
 * - NO direct database manipulation in JavaScript
 * 
 * @param {string} targetUserId - User losing points (Discord ID as string)
 * @param {string} actionByUserId - User performing the action (Discord ID as string)
 * @param {number} amount - Points to remove (must be positive)
 * @param {boolean} allowNegative - Allow negative balance (from config)
 * @param {string|null} reason - Optional reason for transaction
 * @returns {Promise<{before: number, after: number}>}
 */
export async function removePoints(targetUserId, actionByUserId, amount, allowNegative = false, reason = null) {
  // CRITICAL: All Discord IDs remain as strings, never converted to Number
  
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  try {
    // Call PostgreSQL function modify_points() via Supabase RPC
    // Negative balance validation happens INSIDE the database function BEFORE any write
    // This ensures strict enforcement and prevents race conditions
    const { data, error } = await supabase.rpc('modify_points', {
      p_target_user_id: targetUserId,        // String safely converted to BIGINT by Postgres
      p_action_by_user_id: actionByUserId,   // String safely converted to BIGINT by Postgres
      p_action_type: 'REMOVE',
      p_amount: amount,
      p_allow_negative: allowNegative,       // Config setting passed to database
      p_reason: reason,
    });

    if (error) {
      console.error('Database RPC error:', error);
      
      // Map specific database errors to user-friendly messages
      if (error.message && error.message.includes('Insufficient points')) {
        // Database rejected the operation due to negative balance constraint
        throw new Error(error.message);
      }
      
      throw new Error(error.message || 'Failed to remove points');
    }

    // Database returns JSON with before_points and after_points
    return {
      before: data.before_points,
      after: data.after_points,
    };
  } catch (error) {
    console.error('Error removing points:', error);
    // Re-throw with original error message (preserves validation failures from DB)
    throw error;
  }
}

/**
 * Get points history for a user
 * READ ONLY - No modifications to database
 * @param {string} userId - Discord user ID (kept as string)
 * @returns {Promise<Array>} History records with UTC timestamps
 */
export async function getPointsHistory(userId) {
  try {
    // CRITICAL: userId stays as string for safe BIGINT comparison
    const { data, error } = await supabase
      .from('points_history')
      .select('*')
      .eq('target_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Timestamps are already in UTC (TIMESTAMPTZ in PostgreSQL)
    // Conversion to local time happens only when generating history file
    return data || [];
  } catch (error) {
    console.error('Error fetching points history:', error);
    throw new Error('Failed to fetch points history');
  }
}

/**
 * Check database connection
 */
export async function checkDatabaseConnection() {
  try {
    const { error } = await supabase.from('staff_points').select('id').limit(1);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}