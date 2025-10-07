import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle = () => {
  const { isDarkMode, toggleTheme, bg, text, border, hover, button } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-blue-500 hover:opacity-80"
      style={{
        backgroundColor: isDarkMode ? '#374151' : '#f3f4f6', // gray-700 : gray-100
        color: isDarkMode ? '#ffffff' : '#111827', // white : gray-900
        borderColor: isDarkMode ? '#4b5563' : '#d1d5db' // gray-600 : gray-300
      }}
      title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
    >
      {isDarkMode ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
};

export default ThemeToggle;
