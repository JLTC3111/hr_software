import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import MorphingTimeIcon from './morphingTimeIcon';
import MorphingSVG from './morphingSVG';

const MorphingShowcase = () => {
  const { bg, text, border, isDarkMode } = useTheme();
  const [clockMode, setClockMode] = useState('clock');

  // Status indicator shapes
  const statusShapes = [
    {
      name: 'Active',
      path: 'M50,10 A40,40 0 1,1 50,90 A40,40 0 1,1 50,10 M35,50 L45,60 L65,35',
      viewBox: '0 0 100 100'
    },
    {
      name: 'Pending',
      path: 'M50,10 A40,40 0 1,1 50,90 A40,40 0 1,1 50,10 M50,30 L50,50 M50,60 L50,65',
      viewBox: '0 0 100 100'
    },
    {
      name: 'Warning',
      path: 'M50,10 L90,85 L10,85 Z M50,35 L50,60 M50,70 L50,75',
      viewBox: '0 0 100 100'
    }
  ];

  // UI element shapes
  const uiShapes = [
    {
      name: 'Menu',
      path: 'M20,30 L80,30 M20,50 L80,50 M20,70 L80,70',
      viewBox: '0 0 100 100'
    },
    {
      name: 'Close',
      path: 'M30,30 L70,70 M70,30 L30,70',
      viewBox: '0 0 100 100'
    },
    {
      name: 'Check',
      path: 'M25,50 L40,65 L75,30',
      viewBox: '0 0 100 100'
    }
  ];

  return (
    <div className={`p-6 space-y-8 ${bg.primary}`}>
      {/* Header */}
      <div>
        <h2 className={`text-3xl font-bold ${text.primary} mb-2`}>
          🎨 Flubber Morphing Integration
        </h2>
        <p className={text.secondary}>
          Smooth SVG morphing animations powered by Flubber
        </p>
      </div>

      {/* Interactive Time Icon Demo */}
      <div className={`${bg.secondary} rounded-xl p-6 border ${border.primary}`}>
        <h3 className={`text-xl font-semibold ${text.primary} mb-4`}>
          Interactive Time Icon
        </h3>
        <div className="flex items-center space-x-6">
          <MorphingTimeIcon
            mode={clockMode}
            size={80}
            isDarkMode={isDarkMode}
          />
          <div className="flex-1">
            <p className={`text-sm ${text.secondary} mb-3`}>
              Click to morph between clock and calendar
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setClockMode('clock')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  clockMode === 'clock'
                    ? 'bg-blue-600 text-white'
                    : isDarkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🕐 Clock
              </button>
              <button
                onClick={() => setClockMode('calendar')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  clockMode === 'calendar'
                    ? 'bg-green-600 text-white'
                    : isDarkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                📅 Calendar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-morphing Time Icon */}
      <div className={`${bg.secondary} rounded-xl p-6 border ${border.primary}`}>
        <h3 className={`text-xl font-semibold ${text.primary} mb-4`}>
          Auto-Morphing Icon
        </h3>
        <div className="flex items-center space-x-6">
          <MorphingTimeIcon
            mode="clock"
            size={80}
            isDarkMode={isDarkMode}
            autoMorph={true}
            morphInterval={3000}
          />
          <div className="flex-1">
            <p className={`text-sm ${text.secondary}`}>
              Automatically morphs between clock and calendar every 3 seconds
            </p>
          </div>
        </div>
      </div>

      {/* Status Indicators Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Morphing */}
        <div className={`${bg.secondary} rounded-xl p-6 border ${border.primary}`}>
          <h3 className={`text-xl font-semibold ${text.primary} mb-4`}>
            Status Indicators
          </h3>
          <MorphingSVG
            shapes={statusShapes}
            duration={600}
            autoPlay={true}
            autoPlayInterval={2500}
            width={120}
            height={120}
            fill={isDarkMode ? '#60A5FA' : '#3B82F6'}
            className="mx-auto"
          />
        </div>

        {/* UI Element Morphing */}
        <div className={`${bg.secondary} rounded-xl p-6 border ${border.primary}`}>
          <h3 className={`text-xl font-semibold ${text.primary} mb-4`}>
            UI Elements
          </h3>
          <MorphingSVG
            shapes={uiShapes}
            duration={500}
            autoPlay={true}
            autoPlayInterval={2000}
            width={120}
            height={120}
            fill={isDarkMode ? '#34D399' : '#10B981'}
            strokeWidth={6}
            stroke={isDarkMode ? '#34D399' : '#10B981'}
            className="mx-auto"
          />
        </div>
      </div>

      {/* Use Cases */}
      <div className={`${bg.secondary} rounded-xl p-6 border ${border.primary}`}>
        <h3 className={`text-xl font-semibold ${text.primary} mb-4`}>
          Use Cases in HR Software
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="text-2xl">⏰</div>
            <h4 className={`font-semibold ${text.primary}`}>Time Tracking</h4>
            <p className={`text-sm ${text.secondary}`}>
              Morph between clock in/out states, show time transitions
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-2xl">📊</div>
            <h4 className={`font-semibold ${text.primary}`}>Status Updates</h4>
            <p className={`text-sm ${text.secondary}`}>
              Smooth transitions between task states and indicators
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-2xl">🎯</div>
            <h4 className={`font-semibold ${text.primary}`}>UI Feedback</h4>
            <p className={`text-sm ${text.secondary}`}>
              Engaging animations for actions and state changes
            </p>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className={`${bg.secondary} rounded-xl p-6 border ${border.primary}`}>
        <h3 className={`text-xl font-semibold ${text.primary} mb-4`}>
          Features
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            '✨ Smooth path interpolation',
            '🎬 Auto-play support',
            '🎨 Theme-aware colors',
            '⚡ Optimized performance',
            '🔄 Manual control',
            '📱 Responsive design',
            '⏱️ Customizable timing',
            '🎯 Multiple easing functions'
          ].map((feature, idx) => (
            <div key={idx} className={`flex items-center space-x-2 ${text.secondary}`}>
              <span>{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MorphingShowcase;
