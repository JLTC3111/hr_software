# Translation Keys Reference - AdminTimeEntry Component

This document provides the location of translation keys used in the **AdminTimeEntry** component dropdown menus for **Department** and **Position**.

## Overview

The AdminTimeEntry component uses translation keys to display department and position values in multiple languages. These keys are defined in translation files and accessed using the `t()` function.

## Translation File Locations

All translation files are located in:
```
/Users/skycastle3/Desktop/hr_software/src/translations/
```

Available language files:
- `en.js` (English)
- `de.js` (German/Deutsch)
- `vn.js` (Vietnamese)
- `fr.js` (French)
- `es.js` (Spanish)
- `ru.js` (Russian)
- `jp.js` (Japanese)
- `kr.js` (Korean)
- `th.js` (Thai)

## Department Translation Keys

### Location in Translation Files
```javascript
// Example from src/translations/en.js (line 1134-1147)
departments: {
  all: 'All',
  legal_compliance: 'Legal Compliance',
  technology: 'Technology',
  internal_affairs: 'Internal Affairs',
  human_resources: 'Human Resources',
  office_unit: 'Office Unit',
  board_of_directors: 'Board of Directors',
  finance: 'Finance',
  engineering: 'Engineering',
  sales: 'Sales',
  marketing: 'Marketing',
  design: 'Design',
}
```

### Available Department Keys
| Key | Default English Value |
|-----|----------------------|
| `all` | All |
| `legal_compliance` | Legal Compliance |
| `technology` | Technology |
| `internal_affairs` | Internal Affairs |
| `human_resources` | Human Resources |
| `office_unit` | Office Unit |
| `board_of_directors` | Board of Directors |
| `finance` | Finance |
| `engineering` | Engineering |
| `sales` | Sales |
| `marketing` | Marketing |
| `design` | Design |

### Usage in Component
```javascript
// In AdminTimeEntry.jsx dropdown display
{t(`departments.${emp.department}`, emp.department)}
```

---

## Position Translation Keys

### Location in Translation Files
```javascript
// Example from src/translations/en.js (line 761-769)
employeePosition: {
  general_manager: 'General Manager',
  senior_developer: 'Senior Developer',
  hr_specialist: 'HR Manager',
  accountant: 'Chief Accountant',
  contract_manager: 'Contract Manager',
  managing_director: 'Managing Director',
  support_staff: 'Support Staff',
}
```

### Available Position Keys
| Key | Default English Value |
|-----|----------------------|
| `general_manager` | General Manager |
| `senior_developer` | Senior Developer |
| `hr_specialist` | HR Manager |
| `accountant` | Chief Accountant |
| `contract_manager` | Contract Manager |
| `managing_director` | Managing Director |
| `support_staff` | Support Staff |

### Usage in Component
```javascript
// In AdminTimeEntry.jsx dropdown display
{t(`employeePosition.${emp.position}`, emp.position)}
```

---

## How to Add Translations

### Adding a New Department
1. Open your target language file (e.g., `src/translations/vn.js`)
2. Find the `departments:` object (around line 1134 in en.js)
3. Add or modify the key-value pair:
```javascript
departments: {
  // existing keys...
  new_department_key: 'Translated Department Name',
}
```

### Adding a New Position
1. Open your target language file (e.g., `src/translations/vn.js`)
2. Find the `employeePosition:` object (around line 761 in en.js)
3. Add or modify the key-value pair:
```javascript
employeePosition: {
  // existing keys...
  new_position_key: 'Translated Position Name',
}
```

### Example: Adding German Translation
```javascript
// In src/translations/de.js
departments: {
  finance: 'Finanzen',
  engineering: 'Technik',
  human_resources: 'Personalwesen',
  // ...
}

employeePosition: {
  general_manager: 'Geschäftsführer',
  senior_developer: 'Senior-Entwickler',
  hr_specialist: 'Personalleiter',
  // ...
}
```

---

## Notes

- **Fallback Values**: If a translation key is not found, the component will display the original key value (e.g., `contract_manager` instead of "Contract Manager")
- **Consistency**: Ensure all language files have the same keys to maintain consistency across languages
- **Format**: Use snake_case for keys (e.g., `legal_compliance`, not `legalCompliance`)
- **Database Values**: The database stores values in snake_case format (e.g., `finance`, `senior_developer`), which directly maps to translation keys

---

## AdminTimeEntry Component Changes (Oct 31, 2025)

### Enhancements Made:
1. ✅ **Employee Removal After Bulk Entry Creation**
   - Employees who have had time entries created are now tracked in `processedEmployeeIds` state
   - These employees are automatically filtered out from the dropdown to prevent duplicate entries
   - The filter is applied in `filteredEmployees` calculation (line 226-236)

2. ✅ **Correct Count Display**
   - Added a secondary count badge in the "Selected Employees" section (line 344-346)
   - Shows count as "X employee" or "X employees" with proper pluralization
   - Green badge color for better visibility

3. ✅ **Translation Integration**
   - Department and position values in dropdown now use translation keys
   - Applied to both search dropdown (line 323) and selected employees display (line 357)
   - Format: `t(\`employeePosition.${emp.position}\`, emp.position)` and `t(\`departments.${emp.department}\`, emp.department)`

### Code Locations:
- **State tracking**: Line 20 - `processedEmployeeIds` state
- **Employee filtering**: Line 226-236 - Filters out processed employees
- **Count display**: Line 344-346 - Shows accurate count badge
- **Translation usage**: Lines 323, 357 - Translates department/position values

---

## Quick Reference

**To translate departments and positions:**
1. Edit the appropriate language file in `/src/translations/`
2. Modify the `departments` and `employeePosition` objects
3. Keep the keys the same, only change the values
4. Save and refresh the application

**Example Vietnamese Translation:**
```javascript
// src/translations/vn.js
departments: {
  finance: 'Tài chính',
  engineering: 'Kỹ thuật',
  human_resources: 'Nhân sự',
}

employeePosition: {
  contract_manager: 'Quản lý hợp đồng',
  accountant: 'Kế toán trưởng',
}
```
