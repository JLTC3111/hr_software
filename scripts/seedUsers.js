/**
 * Seed Users Script
 * Creates auth users and syncs them with hr_users table
 * 
 * Prerequisites:
 * 1. Run seed_employees_and_users.sql first
 * 2. Set SUPABASE_SERVICE_ROLE_KEY in .env
 * 
 * Usage:
 *   node scripts/seedUsers.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables!');
  console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create admin client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Employees data from App.jsx
const employees = [
  {
    id: 1,
    name: 'Trịnh Thị Tình',
    position: 'general_manager',
    department: 'legal_compliance',
    email: 'info@icue.vn',
    phone: '+84 909 999 999',
    startDate: '2015-01-15',
    status: 'Active',
    photo: 'employeeProfilePhotos/tinh.png',
    defaultPassword: 'IcueHR2024!' // Change this to a secure password
  },
  {
    id: 2,
    name: 'Đỗ Bảo Long',
    position: 'senior_developer',
    department: 'technology',
    email: 'dev@icue.vn',
    phone: '+84 375889900',
    startDate: '2017-08-20',
    status: 'onLeave',
    photo: 'employeeProfilePhotos/longdo.jpg',
    defaultPassword: 'IcueHR2024!'
  },
  {
    id: 3,
    name: 'Nguyễn Thị Ly',
    position: 'hr_specialist',
    department: 'human_resources',
    email: 'support@icue.vn',
    phone: '+84 909 999 999',
    startDate: '2023-03-10',
    status: 'Active',
    photo: 'employeeProfilePhotos/lyly.png',
    defaultPassword: 'IcueHR2024!'
  },
  {
    id: 4,
    name: 'Nguyễn Thị Hiến',
    position: 'accountant',
    department: 'finance',
    email: 'billing@icue.vn',
    phone: '+84 909 999 999',
    startDate: '2021-11-05',
    status: 'Active',
    photo: 'employeeProfilePhotos/hien.png',
    defaultPassword: 'IcueHR2024!'
  },
  {
    id: 5,
    name: 'Nguyễn Quỳnh Ly',
    position: 'contract_manager',
    department: 'office_unit',
    email: 'contract@icue.vn',
    phone: '+84 909 999 999',
    startDate: '2023-06-01',
    status: 'Active',
    photo: 'employeeProfilePhotos/quynhly.png',
    defaultPassword: 'IcueHR2024!'
  },
  {
    id: 6,
    name: 'Nguyễn Hồng Hạnh',
    position: 'managing_director',
    department: 'board_of_directors',
    email: 'hanhnguyen@icue.vn',
    phone: '+84 909 999 999',
    startDate: '2017-08-20',
    status: 'Active',
    photo: 'employeeProfilePhotos/nguyenhonghanh.jpg',
    defaultPassword: 'IcueHR2024!'
  },
  {
    id: 7,
    name: 'Đinh Tùng Dương',
    position: 'support_staff',
    department: 'office_unit',
    email: 'duong@icue.vn',
    phone: '+84 909 999 999',
    startDate: '2017-08-20',
    status: 'Inactive',
    photo: 'employeeProfilePhotos/duong.png',
    defaultPassword: 'IcueHR2024!'
  }
];

// Map position to role
const positionToRole = (position) => {
  const roleMap = {
    'general_manager': 'admin',
    'managing_director': 'admin',
    'hr_specialist': 'manager',
    'senior_developer': 'manager',
    'contract_manager': 'manager',
    'accountant': 'employee',
    'support_staff': 'employee'
  };
  return roleMap[position] || 'employee';
};

// Map status to employment_status and is_active
const mapStatus = (status) => {
  const statusMap = {
    'Active': { employment_status: 'active', is_active: true },
    'onLeave': { employment_status: 'on_leave', is_active: true },
    'Inactive': { employment_status: 'terminated', is_active: false }
  };
  return statusMap[status] || { employment_status: 'active', is_active: true };
};

// Create a single user
async function createUser(employee) {
  console.log(`\n📝 Processing ${employee.name} (${employee.email})...`);
  
  try {
    // Check if user already exists
    const { data: existingAuthUser } = await supabase.auth.admin.listUsers();
    const userExists = existingAuthUser?.users?.find(u => u.email === employee.email);
    
    let authUserId;
    
    if (userExists) {
      console.log(`  ℹ️  Auth user already exists: ${userExists.id}`);
      authUserId = userExists.id;
    } else {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: employee.email,
        password: employee.defaultPassword,
        email_confirm: true,
        user_metadata: {
          full_name: employee.name,
          phone: employee.phone
        }
      });
      
      if (authError) {
        console.error(`  ❌ Error creating auth user:`, authError.message);
        return { success: false, error: authError };
      }
      
      authUserId = authData.user.id;
      console.log(`  ✅ Created auth user: ${authUserId}`);
    }
    
    // Split name for first_name and last_name
    const nameParts = employee.name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    
    // Get employee_id from employees table
    const { data: employeeData, error: employeeError } = await supabase
      .from('employees')
      .select('id')
      .eq('email', employee.email)
      .single();
    
    if (employeeError || !employeeData) {
      console.error(`  ⚠️  Employee record not found in database. Run SQL migration first.`);
      return { success: false, error: 'Employee record not found' };
    }
    
    const statusMapping = mapStatus(employee.status);
    
    // Create or update hr_users record
    const { data: hrUserData, error: hrUserError } = await supabase
      .from('hr_users')
      .upsert({
        id: authUserId,
        email: employee.email,
        full_name: employee.name,
        first_name: firstName,
        last_name: lastName,
        phone: employee.phone,
        avatar_url: employee.photo,
        role: positionToRole(employee.position),
        department: employee.department,
        position: employee.position,
        employee_id: employeeData.id,
        hire_date: employee.startDate,
        employment_status: statusMapping.employment_status,
        is_active: statusMapping.is_active,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })
      .select()
      .single();
    
    if (hrUserError) {
      console.error(`  ❌ Error creating hr_user:`, hrUserError.message);
      return { success: false, error: hrUserError };
    }
    
    console.log(`  ✅ Synced to hr_users table`);
    console.log(`  📋 Role: ${positionToRole(employee.position)}, Status: ${statusMapping.employment_status}`);
    
    return { success: true, authUserId, hrUserData };
    
  } catch (error) {
    console.error(`  ❌ Unexpected error:`, error.message);
    return { success: false, error };
  }
}

// Main seeding function
async function seedAllUsers() {
  console.log('🌱 Starting user seeding process...\n');
  console.log(`📊 Total employees to process: ${employees.length}\n`);
  console.log('⚠️  Default password for all users: IcueHR2024!');
  console.log('   (Users should change this on first login)\n');
  console.log('='.repeat(60));
  
  const results = {
    success: [],
    failed: []
  };
  
  for (const employee of employees) {
    const result = await createUser(employee);
    
    if (result.success) {
      results.success.push(employee.email);
    } else {
      results.failed.push({ email: employee.email, error: result.error });
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 SEEDING SUMMARY\n');
  console.log(`✅ Successfully created: ${results.success.length} users`);
  console.log(`❌ Failed: ${results.failed.length} users\n`);
  
  if (results.success.length > 0) {
    console.log('✅ Successfully created users:');
    results.success.forEach(email => console.log(`   - ${email}`));
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed users:');
    results.failed.forEach(({ email, error }) => {
      console.log(`   - ${email}: ${error?.message || error}`);
    });
  }
  
  console.log('\n🎉 Seeding process completed!\n');
  console.log('Next steps:');
  console.log('1. Verify users in Supabase Dashboard > Authentication');
  console.log('2. Test login with any of the created accounts');
  console.log('3. Users should change their passwords on first login');
  console.log('4. Remove hardcoded Employees array from App.jsx\n');
}

// Run the seeder
seedAllUsers()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
