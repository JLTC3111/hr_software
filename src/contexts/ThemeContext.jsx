import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // Save theme preference to localStorage
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    
    // Update document class for Tailwind dark mode
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const theme = {
    isDarkMode,
    toggleTheme,
    // Theme-aware classes
    bg: {
      primary: isDarkMode ? 'bg-gray-900' : 'bg-white',
      secondary: isDarkMode ? 'bg-gray-800' : 'bg-gray-100',
      tertiary: isDarkMode ? 'bg-gray-700' : 'bg-gray-50',
    },
    text: {
      primary: isDarkMode ? 'text-white' : 'text-gray-900',
      secondary: isDarkMode ? 'text-white' : 'text-gray-600',
      tertiary: isDarkMode ? 'text-white' : 'text-gray-500',
      fill: isDarkMode ? 'fill-white' : 'fill-gray-900',
    },
    border: {
      primary: isDarkMode ? 'border-gray-700' : 'border-gray-200',
      secondary: isDarkMode ? 'border-gray-600' : 'border-gray-300',
    },
    hover: {
      bg: isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200',
    },
    input: {
      bg: isDarkMode ? 'bg-gray-700' : 'bg-white',
      border: isDarkMode ? 'border-gray-600' : 'border-gray-300',
      text: isDarkMode ? 'text-white' : 'text-gray-900',
      placeholder: isDarkMode ? 'placeholder-gray-400' : 'placeholder-gray-500',
    },
    button: {
      primary: isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white',
      secondary: isDarkMode 
        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 border-gray-600' 
        : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300',
    }
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};
