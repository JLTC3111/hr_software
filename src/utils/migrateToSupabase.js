/**
 * Migration Utility for Supabase
 * This script helps migrate existing localStorage data to Supabase
 */

import * as timeTrackingService from '../services/timeTrackingService';

/**
 * Migrate employees from localStorage to Supabase
 */
export const migrateEmployees = async (employees) => {
  console.log('🔄 Starting employee migration...');
  
  try {
    const result = await timeTrackingService.syncEmployeesToSupabase(employees);
    
    if (result.success) {
      console.log(`✅ Successfully migrated ${result.data.length} employees`);
      return { success: true, count: result.data.length };
    } else {
      console.error('❌ Migration failed:', result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('❌ Migration error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Migrate time entries from localStorage to Supabase
 */
export const migrateTimeEntries = async (userId) => {
  console.log('🔄 Starting time entries migration...');
  
  try {
    // Get time entries from localStorage
    const localData = localStorage.getItem(`timeEntries_${userId}`);
    
    if (!localData) {
      console.log('ℹ️ No local time entries found');
      return { success: true, count: 0 };
    }
    
    const entries = JSON.parse(localData);
    let successCount = 0;
    let errorCount = 0;
    
    // Migrate each entry
    for (const entry of entries) {
      try {
        const result = await timeTrackingService.createTimeEntry({
          employeeId: entry.userId || userId,
          date: entry.date,
          clockIn: entry.clockIn,
          clockOut: entry.clockOut,
          hours: parseFloat(entry.hours),
          hourType: entry.hourType,
          notes: entry.notes || null,
          proofFileUrl: null,
          proofFileName: null,
          proofFileType: null
        });
        
        if (result.success) {
          successCount++;
          console.log(`✅ Migrated entry: ${entry.date}`);
        } else {
          errorCount++;
          console.error(`❌ Failed to migrate entry: ${entry.date}`, result.error);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error migrating entry: ${entry.date}`, error);
      }
    }
    
    console.log(`✅ Migration complete: ${successCount} success, ${errorCount} errors`);
    return { success: true, successCount, errorCount };
  } catch (error) {
    console.error('❌ Migration error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check Supabase connection
 */
export const checkSupabaseConnection = async () => {
  try {
    const result = await timeTrackingService.getAllEmployees();
    
    if (result.success) {
      console.log('✅ Supabase connection successful');
      return { connected: true, employeeCount: result.data.length };
    } else {
      console.error('❌ Supabase connection failed:', result.error);
      return { connected: false, error: result.error };
    }
  } catch (error) {
    console.error('❌ Connection error:', error);
    return { connected: false, error: error.message };
  }
};

/**
 * Full migration workflow
 */
export const runFullMigration = async (employees, userId) => {
  console.log('🚀 Starting full migration to Supabase...\n');
  
  // Step 1: Check connection
  console.log('Step 1: Checking Supabase connection...');
  const connectionCheck = await checkSupabaseConnection();
  if (!connectionCheck.connected) {
    console.error('❌ Cannot connect to Supabase. Please check your configuration.');
    return { success: false, error: 'Connection failed' };
  }
  console.log('✅ Connection successful\n');
  
  // Step 2: Migrate employees
  console.log('Step 2: Migrating employees...');
  const employeesResult = await migrateEmployees(employees);
  if (!employeesResult.success) {
    console.error('❌ Employee migration failed');
    return { success: false, error: 'Employee migration failed' };
  }
  console.log(`✅ Migrated ${employeesResult.count} employees\n`);
  
  // Step 3: Migrate time entries
  console.log('Step 3: Migrating time entries...');
  const entriesResult = await migrateTimeEntries(userId);
  if (!entriesResult.success) {
    console.error('⚠️ Time entries migration had errors');
  } else {
    console.log(`✅ Migrated ${entriesResult.successCount} time entries\n`);
  }
  
  console.log('🎉 Migration complete!');
  console.log('\nSummary:');
  console.log(`- Employees: ${employeesResult.count}`);
  console.log(`- Time Entries: ${entriesResult.successCount || 0}`);
  
  return {
    success: true,
    employees: employeesResult.count,
    timeEntries: entriesResult.successCount || 0
  };
};

/**
 * Clear localStorage after successful migration
 */
export const clearLocalStorage = (userId) => {
  if (window.confirm('⚠️ Are you sure you want to clear local data? This cannot be undone.')) {
    localStorage.removeItem(`timeEntries_${userId}`);
    localStorage.removeItem('employees');
    localStorage.removeItem('employeePhotos');
    console.log('✅ Local storage cleared');
    return true;
  }
  return false;
};

export default {
  migrateEmployees,
  migrateTimeEntries,
  checkSupabaseConnection,
  runFullMigration,
  clearLocalStorage
};
