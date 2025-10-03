// Admin script to set temporary passwords for HR users
// Run this in your browser console or as a Node.js script

// Configuration - Update these values
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Default temporary password (users will be forced to change this)
const DEFAULT_TEMP_PASSWORD = 'TempHR2024!';

// Function to set temporary passwords for all users
async function setTemporaryPasswordsForAllUsers() {
  try {
    console.log('🔄 Setting up temporary passwords for HR users...');

    // First, get all users from hr_users table
    const getUsersResponse = await fetch(`${SUPABASE_URL}/rest/v1/hr_users?select=email,full_name,role`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });

    if (!getUsersResponse.ok) {
      throw new Error(`Failed to fetch users: ${getUsersResponse.statusText}`);
    }

    const users = await getUsersResponse.json();
    console.log(`📋 Found ${users.length} users to set up`);

    // Extract emails
    const userEmails = users.map(user => user.email);

    // Call the Edge Function to set passwords
    const setPasswordResponse = await fetch(`${SUPABASE_URL}/functions/v1/set-temp-passwords`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userEmails: userEmails,
        tempPassword: DEFAULT_TEMP_PASSWORD
      })
    });

    if (!setPasswordResponse.ok) {
      throw new Error(`Failed to set passwords: ${setPasswordResponse.statusText}`);
    }

    const results = await setPasswordResponse.json();
    
    // Display results
    console.log('📊 Password Setup Results:');
    console.log('========================');
    
    const successful = results.results.filter(r => r.success);
    const failed = results.results.filter(r => !r.success);

    console.log(`✅ Successfully set passwords for ${successful.length} users`);
    console.log(`❌ Failed to set passwords for ${failed.length} users`);

    if (successful.length > 0) {
      console.log('\n✅ Successful users:');
      successful.forEach(user => {
        console.log(`  - ${user.email}: Password set to "${user.tempPassword}"`);
      });
    }

    if (failed.length > 0) {
      console.log('\n❌ Failed users:');
      failed.forEach(user => {
        console.log(`  - ${user.email}: ${user.error}`);
      });
    }

    console.log('\n📝 Next Steps:');
    console.log('1. Share the temporary password with users through a secure channel');
    console.log('2. Users will be prompted to change their password on first login');
    console.log('3. Users cannot access the application until they change their password');

    return results;

  } catch (error) {
    console.error('❌ Error setting up temporary passwords:', error);
    throw error;
  }
}

// Function to set password for specific users
async function setTemporaryPasswordsForUsers(emails, customPassword = DEFAULT_TEMP_PASSWORD) {
  try {
    console.log(`🔄 Setting temporary passwords for ${emails.length} specific users...`);

    const setPasswordResponse = await fetch(`${SUPABASE_URL}/functions/v1/set-temp-passwords`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userEmails: emails,
        tempPassword: customPassword
      })
    });

    if (!setPasswordResponse.ok) {
      throw new Error(`Failed to set passwords: ${setPasswordResponse.statusText}`);
    }

    const results = await setPasswordResponse.json();
    console.log('Password setup results:', results);
    return results;

  } catch (error) {
    console.error('Error setting passwords for specific users:', error);
    throw error;
  }
}

// Usage examples:

// 1. Set temporary passwords for ALL users
// setTemporaryPasswordsForAllUsers();

// 2. Set temporary passwords for specific users
// setTemporaryPasswordsForUsers([
//   'john@company.com',
//   'jane@company.com'
// ]);

// 3. Set custom temporary password for specific users
// setTemporaryPasswordsForUsers([
//   'admin@company.com'
// ], 'CustomAdminPass123!');

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    setTemporaryPasswordsForAllUsers,
    setTemporaryPasswordsForUsers
  };
}