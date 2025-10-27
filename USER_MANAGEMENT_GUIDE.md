# User Management Guide

## Overview
The HR software now includes comprehensive user management capabilities, allowing administrators to manage user accounts, including deletion with proper foreign key constraint handling.

## Features

### 1. User Management Interface
- **View all users** with filtering and search
- **Deactivate/Reactivate** user accounts
- **Delete users** permanently with proper cleanup
- **Search and filter** by role, status, and keywords

### 2. Safe User Deletion
The system handles user deletion safely by:
- Removing/nullifying all foreign key references
- Cleaning up related data (time entries, leave requests, etc.)
- Preventing orphaned records
- Multi-step confirmation for safety

## Setup Instructions

### Step 1: Run Database Migration

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Open and run the file: `database_migrations/user_deletion_setup.sql`

This will:
- Set up proper foreign key constraints with `ON DELETE SET NULL`
- Add performance indexes
- Allow safe user deletion

### Step 2: Add User Management to Your Routes

```jsx
// In your App.jsx or routing file
import { UserManagement } from './components';

// Add route
<Route path="/user-management" element={<UserManagement />} />
```

### Step 3: Add to Sidebar Navigation (for Admins)

```jsx
// In sidebar.jsx
{user?.role === 'admin' && (
  <button onClick={() => navigate('/user-management')}>
    <Users className="h-5 w-5" />
    <span>User Management</span>
  </button>
)}
```

## Usage

### Accessing User Management
- Only users with **Admin** role can access
- Navigate to `/user-management` route
- Or add a link in your admin dashboard

### Deactivating a User
1. Click the **UserX** (deactivate) icon
2. Confirm the action
3. User will be marked as inactive (can't log in)
4. Data is preserved for later reactivation

**When to use:**
- Temporary suspension
- Employee on leave
- Preserving data for audit purposes

### Reactivating a User
1. Filter by "Inactive" status
2. Click the **UserCheck** (reactivate) icon
3. Confirm the action
4. User can log in again

### Deleting a User Permanently

⚠️ **WARNING: This action cannot be undone!**

1. Click the **Trash** icon
2. Read the warning dialog carefully
3. Type `DELETE [USERNAME]` exactly as shown
4. Confirm deletion

**What gets deleted:**
- User account from `hr_users` table
- User from `auth.users` (if admin key configured)
- Time clock entries
- Leave requests
- Overtime logs
- Performance data

**What gets preserved:**
- Employee record (with nullified link)
- Historical reports
- Audit logs

## API Usage

### Programmatic User Management

```javascript
import * as userService from '../services/userService';

// Get all users
const result = await userService.getAllUsers({
  role: 'employee',
  is_active: true
});

// Deactivate user
await userService.deactivateUser(userId);

// Reactivate user
await userService.reactivateUser(userId);

// Delete user permanently
await userService.deleteUser(userId);

// Bulk delete
await userService.bulkDeleteUsers([userId1, userId2]);
```

## Foreign Key Constraint Options

### Option 1: SET NULL (Default - Recommended)
```sql
ON DELETE SET NULL
```
- **Pros:** Preserves all data, prevents data loss
- **Cons:** Some records will have null user references
- **Use case:** Most production environments

### Option 2: CASCADE
```sql
ON DELETE CASCADE
```
- **Pros:** Clean deletion, no orphaned data
- **Cons:** Deletes ALL related records (destructive)
- **Use case:** Development/testing environments

To use CASCADE instead of SET NULL:
1. Open `database_migrations/user_deletion_setup.sql`
2. Uncomment the CASCADE section
3. Comment out the SET NULL section
4. Run the script

## Troubleshooting

### Error: "Foreign key constraint violation"
**Solution:** Run the database migration script to update constraints

### Error: "signOut is not a function"
**Solution:** Already fixed - AuthContext now exports both `logout` and `signOut`

### Error: "Access Denied"
**Solution:** Ensure user has admin role in `hr_users` table

### Error: "Could not delete from auth.users"
**Solution:** This requires Supabase service role key. User will still be deleted from `hr_users` table.

## Security Considerations

1. **Multi-step Confirmation:** Users must type the full name to confirm deletion
2. **Admin Only:** Only admin users can access user management
3. **Audit Trail:** Consider logging all deletion actions
4. **Soft Delete First:** Recommend deactivating before permanent deletion
5. **Backup Before Bulk Operations:** Always backup before bulk deletions

## Best Practices

### 1. Use Deactivation for Temporary Situations
```javascript
// Instead of deleting an employee on leave:
await userService.deactivateUser(userId);
```

### 2. Regular Backups
```bash
# Backup before major operations
supabase db dump -f backup_$(date +%Y%m%d).sql
```

### 3. Audit Logging
```javascript
// Log all user deletions
await supabase.from('audit_logs').insert({
  action: 'USER_DELETED',
  user_id: deletedUserId,
  performed_by: currentUser.id,
  timestamp: new Date()
});
```

### 4. Notification on Deletion
```javascript
// Notify relevant parties
await sendNotification({
  type: 'USER_DELETED',
  message: `User ${userName} was deleted by ${admin.name}`,
  recipients: ['hr@company.com', 'admin@company.com']
});
```

## Components

### UserManagement Component
- **Location:** `src/components/userManagement.jsx`
- **Props:** None (uses context)
- **Features:**
  - User list with search/filter
  - Deactivate/Reactivate buttons
  - Delete with confirmation
  - Statistics dashboard

### User Service
- **Location:** `src/services/userService.js`
- **Functions:**
  - `deleteUser(userId)`
  - `deactivateUser(userId)`
  - `reactivateUser(userId)`
  - `getAllUsers(filters)`
  - `bulkDeleteUsers(userIds)`

## Example: Adding to Settings Page

```jsx
// In settings.jsx
import { UserManagement } from './components';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('profile');
  
  return (
    <div>
      <Tabs>
        <Tab value="profile">Profile</Tab>
        <Tab value="notifications">Notifications</Tab>
        {isAdmin && <Tab value="users">User Management</Tab>}
      </Tabs>
      
      {activeTab === 'users' && <UserManagement />}
    </div>
  );
};
```

## Testing Checklist

- [ ] Run database migration successfully
- [ ] Admin can access User Management page
- [ ] Non-admin gets access denied message
- [ ] Search functionality works
- [ ] Role filter works
- [ ] Status filter works
- [ ] Can deactivate a user
- [ ] Can reactivate a user
- [ ] Delete requires exact name typing
- [ ] Delete confirmation shows warning
- [ ] User is removed from database after deletion
- [ ] Related records are cleaned up
- [ ] No orphaned foreign keys remain

## Support

If you encounter issues:
1. Check console logs for errors
2. Verify database migration ran successfully
3. Ensure user has admin role
4. Check Supabase logs for database errors

For more help, check the application logs or contact your system administrator.
