import React from 'react'
import { Search, Filter } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'

const SearchAndFilter = ({ searchTerm, setSearchTerm, filterDepartment, setFilterDepartment, departments, style }) => {
  const { t } = useLanguage();
  
  return (
    <div className="p-4 rounded-lg shadow-sm border" style={style}>
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="flex-1 relative">
          <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2" style={{ color: style?.color || '#9ca3af' }} />
          <input
            type="text"
            placeholder={t('search.placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            style={{
              backgroundColor: style?.backgroundColor || '#ffffff',
              color: style?.color || '#111827',
              borderColor: style?.borderColor || '#d1d5db'
            }}
          />
        </div>
        <div className="relative">
          <Filter className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 cursor-pointer" style={{ color: style?.color || '#9ca3af' }} />
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="pl-10 pr-8 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 cursor-pointer focus:border-blue-500 appearance-none"
            style={{
              backgroundColor: style?.backgroundColor || '#ffffff',
              color: style?.color || '#111827',
              borderColor: style?.borderColor || '#d1d5db'
            }}
          >
            {departments.map(dept => (
              <option key={dept} value={dept.toLowerCase()}>{t(`${dept.toLowerCase()}`)}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default SearchAndFilter;
