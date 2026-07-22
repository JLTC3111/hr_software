import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '@/lib/utils';

const ThemeToggle = ({ variant = 'default' }) => {
  const { isDarkMode, toggleTheme } = useTheme();
  const isIntegrated = variant === 'integrated';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'cursor-pointer transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 hover:opacity-80',
        isIntegrated
          ? 'rounded-none border-0 p-2 shrink-0'
          : 'rounded-lg border p-1.5 sm:p-2'
      )}
      style={{
        backgroundColor: isIntegrated ? 'transparent' : isDarkMode ? '#374151' : '#f3f4f6',
        color: isDarkMode ? '#ffffff' : '#111827',
        borderColor: isIntegrated ? 'transparent' : isDarkMode ? '#4b5563' : '#d1d5db',
      }}
      title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
      aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDarkMode ? (
          <motion.div
            key="moon"
            initial={{ opacity: 0, rotate: -360 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: 360 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <Moon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ opacity: 0, rotate: 360 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: -360 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};

export default ThemeToggle;
