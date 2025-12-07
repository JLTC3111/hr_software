import { supabase } from '../config/supabaseClient';
import { isDemoMode, MOCK_USER } from '../utils/demoHelper';

/**
 * Service for managing multiple email addresses per user
 */

/**
 * Get all emails associated with an hr_user
 * @param {string} hrUserId - The hr_user UUID
 * @returns {Promise<{success: boolean, data?: array, error?: string}>}
 */
export const getUserEmails = async (hrUserId) => {
  if (isDemoMode()) {
    if (hrUserId === MOCK_USER.id) {
      return {
        success: true,
        data: [
          {
            hr_user_id: MOCK_USER.id,
            auth_user_id: MOCK_USER.id,
            email: MOCK_USER.email,
            is_primary: true
          }
        ]
      };
    }
    return { success: true, data: [] };
  }

  try {
    const { data, error } = await supabase
      .from('user_emails')
      .select('*')
      .eq('hr_user_id', hrUserId)
      .order('is_primary', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error fetching user emails:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get the hr_user_id from an auth_user_id
 * @param {string} authUserId - The auth.users UUID
 * @returns {Promise<{success: boolean, hrUserId?: string, error?: string}>}
 */
export const getHrUserIdFromAuth = async (authUserId) => {
  if (isDemoMode()) {
    if (authUserId === MOCK_USER.id) {
      return { success: true, hrUserId: MOCK_USER.id };
    }
    return { success: false, error: 'User not found' };
  }

  try {
    const { data, error } = await supabase
      .from('user_emails')
      .select('hr_user_id')
      .eq('auth_user_id', authUserId)
      .single();

    if (error) {
      // If not found in user_emails, check if it exists directly in hr_users (backward compatibility)
      const { data: hrUserData, error: hrUserError } = await supabase
        .from('hr_users')
        .select('id')
        .eq('id', authUserId)
        .single();

      if (hrUserError) throw hrUserError;
      
      return { success: true, hrUserId: hrUserData.id };
    }

    return { success: true, hrUserId: data.hr_user_id };
  } catch (error) {
    console.error('Error getting hr_user_id from auth_user_id:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Link an additional email (auth account) to an existing hr_user
 * @param {string} hrUserId - The hr_user UUID to link to
 * @param {string} authUserId - The auth.users UUID to link
 * @param {string} email - The email address
 * @param {boolean} isPrimary - Whether this should be the primary email
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const linkEmailToUser = async (hrUserId, authUserId, email, isPrimary = false) => {
  if (isDemoMode()) {
    return { success: true };
  }

  try {
    // Check if the auth account already exists in the system
    const { data: existingLink } = await supabase
      .from('user_emails')
      .select('hr_user_id, email')
      .eq('auth_user_id', authUserId)
      .single();

    if (existingLink && existingLink.hr_user_id !== hrUserId) {
      return {
        success: false,
        error: `This auth account is already linked to another user (${existingLink.email})`
      };
    }

    // Insert or update the email link
    const { error: insertError } = await supabase
      .from('user_emails')
      .upsert({
        hr_user_id: hrUserId,
        auth_user_id: authUserId,
        email: email,
        is_primary: isPrimary
      }, {
        onConflict: 'auth_user_id'
      });

    if (insertError) throw insertError;

    // If this is set as primary, update other emails and hr_users
    if (isPrimary) {
      // Unset primary flag on other emails for this user
      await supabase
        .from('user_emails')
        .update({ is_primary: false })
        .eq('hr_user_id', hrUserId)
        .neq('auth_user_id', authUserId);

      // Update hr_users primary_email and email fields
      await supabase
        .from('hr_users')
        .update({
          primary_email: email,
          email: email
        })
        .eq('id', hrUserId);
    }

    console.log(`✅ Successfully linked email ${email} to user ${hrUserId}`);
    return { success: true };
  } catch (error) {
    console.error('Error linking email to user:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Remove an email link from a user (but keep the auth account)
 * @param {string} authUserId - The auth.users UUID to unlink
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const unlinkEmailFromUser = async (authUserId) => {
  if (isDemoMode()) {
    return { success: true };
  }

  try {
    // Check if this is the only email for the user
    const { data: emailData } = await supabase
      .from('user_emails')
      .select('hr_user_id')
      .eq('auth_user_id', authUserId)
      .single();

    if (!emailData) {
      return { success: false, error: 'Email link not found' };
    }

    const { data: allEmails } = await supabase
      .from('user_emails')
      .select('id')
      .eq('hr_user_id', emailData.hr_user_id);

    if (allEmails && allEmails.length === 1) {
      return { success: false, error: 'Cannot remove the only email for a user' };
    }

    // Delete the email link
    const { error } = await supabase
      .from('user_emails')
      .delete()
      .eq('auth_user_id', authUserId);

    if (error) throw error;

    console.log(`✅ Successfully unlinked auth account ${authUserId}`);
    return { success: true };
  } catch (error) {
    console.error('Error unlinking email from user:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Set an email as the primary email for a user
 * @param {string} authUserId - The auth.users UUID to set as primary
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const setPrimaryEmail = async (authUserId) => {
  if (isDemoMode()) {
    return { success: true };
  }

  try {
    // Get the email data
    const { data: emailData, error: fetchError } = await supabase
      .from('user_emails')
      .select('hr_user_id, email')
      .eq('auth_user_id', authUserId)
      .single();

    if (fetchError) throw fetchError;

    // Unset primary flag on all emails for this user
    await supabase
      .from('user_emails')
      .update({ is_primary: false })
      .eq('hr_user_id', emailData.hr_user_id);

    // Set this email as primary
    const { error: updateError } = await supabase
      .from('user_emails')
      .update({ is_primary: true })
      .eq('auth_user_id', authUserId);

    if (updateError) throw updateError;

    // Update hr_users primary_email and email fields
    await supabase
      .from('hr_users')
      .update({
        primary_email: emailData.email,
        email: emailData.email
      })
      .eq('id', emailData.hr_user_id);

    console.log(`✅ Set ${emailData.email} as primary for user ${emailData.hr_user_id}`);
    return { success: true };
  } catch (error) {
    console.error('Error setting primary email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all users with their associated emails (for admin view)
 * @returns {Promise<{success: boolean, data?: array, error?: string}>}
 */
export const getAllUsersWithEmails = async () => {
  if (isDemoMode()) {
    return {
      success: true,
      data: [
        {
          hr_user_id: MOCK_USER.id,
          full_name: MOCK_USER.name,
          role: MOCK_USER.role,
          department: MOCK_USER.department,
          is_active: true,
          emails: [
            {
              id: 'mock-email-id-1',
              auth_user_id: 'mock-auth-id-1',
              email: MOCK_USER.email,
              is_primary: true,
              created_at: new Date().toISOString()
            }
          ]
        },
        {
          hr_user_id: 'mock-emp-2',
          full_name: 'Sarah Connor',
          role: 'Employee',
          department: 'Operations',
          is_active: true,
          emails: [
            {
              id: 'mock-email-id-2',
              auth_user_id: 'mock-auth-id-2',
              email: 'sarah.connor@example.com',
              is_primary: true,
              created_at: new Date().toISOString()
            }
          ]
        }
      ]
    };
  }

  try {
    const { data, error } = await supabase
      .from('user_emails_view')
      .select('*')
      .order('hr_user_id, is_primary');

    if (error) throw error;

    // Group emails by hr_user_id
    const grouped = {};
    data.forEach(item => {
      if (!grouped[item.hr_user_id]) {
        grouped[item.hr_user_id] = {
          hr_user_id: item.hr_user_id,
          full_name: item.full_name,
          role: item.role,
          department: item.department,
          is_active: item.is_active,
          emails: []
        };
      }
      grouped[item.hr_user_id].emails.push({
        id: item.id,
        auth_user_id: item.auth_user_id,
        email: item.email,
        is_primary: item.is_primary,
        created_at: item.created_at
      });
    });

    return { success: true, data: Object.values(grouped) };
  } catch (error) {
    console.error('Error getting all users with emails:', error);
    return { success: false, error: error.message };
  }
};
