import { supabase } from './database.js';

/**
 * Validate age against DOB
 * @param {number} inputAge - Age provided by user
 * @param {string} dob - Date of birth (YYYY-MM-DD)
 * @returns {boolean} True if age matches DOB
 */
export function validateAge(inputAge, dob) {
  const birthDate = new Date(dob);
  const today = new Date();
  
  let calculatedAge = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  // If birthday hasn't occurred this year yet, subtract 1
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    calculatedAge--;
  }
  
  return calculatedAge === inputAge;
}

/**
 * Validate date format and validity
 * @param {string} dateString - Date string to validate
 * @returns {Object} { valid: boolean, error: string|null }
 */
export function validateDate(dateString) {
  // Check format
  const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dobRegex.test(dateString)) {
    return { valid: false, error: 'Invalid format. Use YYYY-MM-DD (e.g., 2000-05-27)' };
  }

  // Check if date is actually valid
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date. Please check day/month/year values.' };
  }

  // Check if date is in the future
  const today = new Date();
  if (date > today) {
    return { valid: false, error: 'Date of birth cannot be in the future.' };
  }

  return { valid: true, error: null };
}

/**
 * Get user profile
 * @param {string} userId - Discord user ID
 * @returns {Promise<Object|null>} Profile data or null
 */
export async function getUserProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows found
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw new Error('Failed to fetch profile');
  }
}

/**
 * Create user profile
 * @param {string} userId - Discord user ID
 * @param {Object} profileData - Profile data
 * @returns {Promise<Object>} Created profile
 */
export async function createUserProfile(userId, profileData) {
  try {
    const { displayName, age, dob, bio, tags, avatarUrl, gender } = profileData;

    // Validate date
    const dateValidation = validateDate(dob);
    if (!dateValidation.valid) {
      throw new Error(`DATE_INVALID: ${dateValidation.error}`);
    }

    // Validate age-DOB match
    if (!validateAge(age, dob)) {
      throw new Error('AGE_DOB_MISMATCH');
    }

    // Validate tags (max 5)
    if (tags && tags.length > 5) {
      throw new Error('MAX_TAGS_EXCEEDED');
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        user_id: userId,
        display_name: displayName,
        age: age,
        dob: dob,
        bio: bio || undefined, // Will use default from DB if not provided
        tags: tags || undefined, // Will use default from DB if not provided
        avatar_url: avatarUrl || null,
        gender: gender || null
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    if (error.message.startsWith('DATE_INVALID:') || 
        error.message === 'AGE_DOB_MISMATCH' || 
        error.message === 'MAX_TAGS_EXCEEDED') {
      throw error;
    }
    console.error('Error creating user profile:', error);
    throw new Error('Failed to create profile');
  }
}

/**
 * Update user profile
 * @param {string} userId - Discord user ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated profile
 */
export async function updateUserProfile(userId, updates) {
  try {
    // If DOB or age is being updated, validate them
    if (updates.dob || updates.age) {
      const currentProfile = await getUserProfile(userId);
      
      const newDob = updates.dob || currentProfile.dob;
      const newAge = updates.age !== undefined ? updates.age : currentProfile.age;

      // Validate date if provided
      if (updates.dob) {
        const dateValidation = validateDate(updates.dob);
        if (!dateValidation.valid) {
          throw new Error(`DATE_INVALID: ${dateValidation.error}`);
        }
      }

      // Validate age-DOB match
      if (!validateAge(newAge, newDob)) {
        throw new Error('AGE_DOB_MISMATCH');
      }
    }

    // Validate tags if provided
    if (updates.tags && updates.tags.length > 5) {
      throw new Error('MAX_TAGS_EXCEEDED');
    }

    // Map camelCase to snake_case for DB
    const dbUpdates = {};
    if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
    if (updates.age !== undefined) dbUpdates.age = updates.age;
    if (updates.dob !== undefined) dbUpdates.dob = updates.dob;
    if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
    if (updates.gender !== undefined) dbUpdates.gender = updates.gender;
    
    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('user_profiles')
      .update(dbUpdates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    if (error.message.startsWith('DATE_INVALID:') || 
        error.message === 'AGE_DOB_MISMATCH' || 
        error.message === 'MAX_TAGS_EXCEEDED') {
      throw error;
    }
    console.error('Error updating user profile:', error);
    throw new Error('Failed to update profile');
  }
}

/**
 * Get pinned bot update
 * @returns {Promise<Object|null>} Pinned update or null
 */
export async function getPinnedUpdate() {
  try {
    const { data, error } = await supabase
      .from('bot_updates')
      .select('*')
      .eq('is_pinned', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data || null;
  } catch (error) {
    console.error('Error fetching pinned update:', error);
    return null;
  }
}

/**
 * Get bot update by page
 * @param {number} page - Page number (1-indexed)
 * @returns {Promise<Object|null>} Update or null
 */
export async function getUpdateByPage(page = 1) {
  try {
    const offset = page - 1;
    const { data, error } = await supabase
      .from('bot_updates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .range(offset, offset);

    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error fetching update by page:', error);
    return null;
  }
}

/**
 * Get total count of bot updates
 * @returns {Promise<number>} Total count
 */
export async function getTotalUpdatesCount() {
  try {
    const { count, error } = await supabase
      .from('bot_updates')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error fetching updates count:', error);
    return 0;
  }
}

/**
 * Get bot updates (legacy - for backward compatibility)
 * @param {number} limit - Number of updates to fetch
 * @returns {Promise<Array>} Array of updates
 */
export async function getBotUpdates(limit = 5) {
  try {
    const { data, error } = await supabase
      .from('bot_updates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching bot updates:', error);
    throw new Error('Failed to fetch updates');
  }
}

