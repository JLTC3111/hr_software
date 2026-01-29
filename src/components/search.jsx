import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react'
import { Search, Filter } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'

const SearchAndFilter = memo(({ searchTerm, setSearchTerm, filterDepartment, setFilterDepartment, departments, employeeDepartment, style }) => {
  const { t } = useLanguage();
  const filterSelectRef = useRef(null);
  
  // Local state for immediate input feedback
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);

  // Sync local state with prop when prop changes externally
  useEffect(() => {
    setLocalSearchTerm(searchTerm);
  }, [searchTerm]);

  // Debounce search term updates to parent
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearchTerm !== searchTerm) {
        setSearchTerm(localSearchTerm);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearchTerm, searchTerm, setSearchTerm]);

  // Memoize input handler
  const handleSearchChange = useCallback((e) => {
    setLocalSearchTerm(e.target.value);
  }, []);

  // Memoize filter handler
  const handleFilterChange = useCallback((e) => {
    setFilterDepartment(e.target.value);
  }, [setFilterDepartment]);

  // Memoize input style
  const inputStyle = useMemo(() => ({
    backgroundColor: style?.backgroundColor || '#ffffff',
    color: style?.color || '#111827',
    borderColor: style?.borderColor || '#d1d5db'
  }), [style?.backgroundColor, style?.color, style?.borderColor]);

  // Memoize icon color
  const iconColor = useMemo(() => ({ color: style?.color || '#9ca3af' }), [style?.color]);

  const departmentOptions = useMemo(() => {
    return (departments || employeeDepartment || []);
  }, [departments, employeeDepartment]);

  const handleFilterIconClick = useCallback(() => {
    filterSelectRef.current?.focus();
  }, []);
  
  return (
    <div className="p-4 rounded-lg shadow-sm border" style={style}>
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="flex-1 relative">
          <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2" style={iconColor} />
          <input
            type="text"
            placeholder={t('search.placeholder')}
            value={localSearchTerm}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            style={inputStyle}
          />
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={handleFilterIconClick}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={t('search.filter', 'Filter')}
            title={t('search.filter', 'Filter')}
          >
            <Filter className="h-5 w-5" style={iconColor} />
          </button>
          <select
            ref={filterSelectRef}
            value={filterDepartment}
            onChange={handleFilterChange}
            className="pl-10 pr-8 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 cursor-pointer focus:border-blue-500 appearance-none"
            style={inputStyle}
          >
            {departmentOptions.map(dept => (
              <option key={dept.value} value={dept.value}>{dept.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
});

// Display name for debugging
SearchAndFilter.displayName = 'SearchAndFilter';

export default SearchAndFilter;
