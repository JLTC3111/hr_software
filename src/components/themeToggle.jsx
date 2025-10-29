import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
      <AnimatePresence mode="wait" initial={false}>
      {isDarkMode ? (
        <motion.div
          key="moon" // CRITICAL: Key allows AnimatePresence to track state change
          initial={{ opacity: 0, rotate: -360 }} // Starts invisible and spun backwards
          animate={{ opacity: 1, rotate: 0 }}   // Spins to normal and fades in
          exit={{ opacity: 0, rotate: 360 }}    // Spins forward and fades out
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          <Moon className="h-5 w-5" />
        </motion.div>
      ) : (
        <motion.div
          key="sun" // CRITICAL: Key allows AnimatePresence to track state change
          initial={{ opacity: 0, rotate: 360 }} // Starts invisible and spun forwards
          animate={{ opacity: 1, rotate: 0 }}   // Spins to normal and fades in
          exit={{ opacity: 0, rotate: -360 }}   // Spins backward (your request) and fades out
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          <Sun className="h-5 w-5" />
        </motion.div>
      )}
    </AnimatePresence>
    </button>
  );
};

export default ThemeToggle;
