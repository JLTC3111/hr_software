import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import MorphingSVG from './morphingSVG';

const FlubberDemo = () => {
  const { bg, text, border, isDarkMode } = useTheme();
  const { t } = useLanguage();
  const [selectedDemo, setSelectedDemo] = useState('shapes');

  // Basic geometric shapes morphing
  const basicShapes = [
    {
      name: 'Circle',
      path: 'M100,50 A50,50 0 1,1 100,150 A50,50 0 1,1 100,50',
      viewBox: '0 0 200 200'
    },
    {
      name: 'Square',
      path: 'M50,50 L150,50 L150,150 L50,150 Z',
      viewBox: '0 0 200 200'
    },
    {
      name: 'Triangle',
      path: 'M100,40 L160,160 L40,160 Z',
      viewBox: '0 0 200 200'
    },
    {
      name: 'Star',
      path: 'M100,20 L115,70 L165,70 L125,100 L140,150 L100,120 L60,150 L75,100 L35,70 L85,70 Z',
      viewBox: '0 0 200 200'
    },
    {
      name: 'Heart',
      path: 'M100,160 C100,160 40,110 40,80 C40,60 55,50 70,50 C85,50 100,60 100,60 C100,60 115,50 130,50 C145,50 160,60 160,80 C160,110 100,160 100,160 Z',
      viewBox: '0 0 200 200'
    }
  ];

  // Clock and Calendar morphing (from timeClockEntry)
  const timingShapes = [
    {
      name: 'Clock',
      path: 'M100,20 A80,80 0 1,1 100,180 A80,80 0 1,1 100,20 M100,50 L100,100 L140,100',
      viewBox: '0 0 200 200'
    },
    {
      name: 'Calendar',
      path: 'M40,40 L160,40 L160,160 L40,160 Z M50,60 L150,60 M70,40 L70,50 M130,40 L130,50 M60,80 L90,80 M60,100 L140,100 M60,120 L110,120',
      viewBox: '0 0 200 200'
    },
    {
      name: 'Alarm',
      path: 'M100,30 A70,70 0 1,1 100,170 A70,70 0 1,1 100,30 M100,60 L100,100 L130,130 M70,20 L50,10 M130,20 L150,10',
      viewBox: '0 0 200 200'
    }
  ];

  // UI element morphing
  const uiShapes = [
    {
      name: 'Play',
      path: 'M60,40 L60,160 L140,100 Z',
      viewBox: '0 0 200 200'
    },
    {
      name: 'Pause',
      path: 'M60,40 L80,40 L80,160 L60,160 Z M120,40 L140,40 L140,160 L120,160 Z',
      viewBox: '0 0 200 200'
    },
    {
      name: 'Stop',
      path: 'M50,50 L150,50 L150,150 L50,150 Z',
      viewBox: '0 0 200 200'
    },
    {
      name: 'Menu',
      path: 'M40,60 L160,60 M40,100 L160,100 M40,140 L160,140',
      viewBox: '0 0 200 200'
    },
    {
      name: 'Close',
      path: 'M60,60 L140,140 M140,60 L60,140',
      viewBox: '0 0 200 200'
    }
  ];

  // Status indicators
  const statusShapes = [
    {
      name: 'Success',
      path: 'M100,30 A70,70 0 1,1 100,170 A70,70 0 1,1 100,30 M70,100 L90,120 L130,70',
      viewBox: '0 0 200 200'
    },
    {
      name: 'Warning',
      path: 'M100,30 L170,160 L30,160 Z M100,80 L100,120 M100,140 L100,150',
      viewBox: '0 0 200 200'
    },
    {
      name: 'Error',
      path: 'M100,30 A70,70 0 1,1 100,170 A70,70 0 1,1 100,30 M80,80 L120,120 M120,80 L80,120',
      viewBox: '0 0 200 200'
    },
    {
      name: 'Info',
      path: 'M100,30 A70,70 0 1,1 100,170 A70,70 0 1,1 100,30 M100,70 L100,80 M100,95 L100,140',
      viewBox: '0 0 200 200'
    }
  ];

  // Complex morphing - Work related
  const workShapes = [
    {
      name: 'User',
      path: 'M100,50 A30,30 0 1,1 100,110 A30,30 0 1,1 100,50 M60,150 Q60,120 100,120 Q140,120 140,150 L140,170 L60,170 Z',
      viewBox: '0 0 200 200'
    },
    {
      name: 'Task',
      path: 'M60,50 L140,50 L140,150 L60,150 Z M75,80 L95,100 L125,70 M75,110 L125,110 M75,130 L110,130',
      viewBox: '0 0 200 200'
    },
    {
      name: 'Chart',
      path: 'M50,150 L50,50 L150,50 M50,150 L70,120 L90,130 L110,90 L130,100 L150,70',
      viewBox: '0 0 200 200'
    },
    {
      name: 'Settings',
      path: 'M100,60 A40,40 0 1,1 100,140 A40,40 0 1,1 100,60 M100,30 L100,50 M100,150 L100,170 M70,70 L55,55 M145,145 L130,130 M70,130 L55,145 M145,55 L130,70 M30,100 L50,100 M150,100 L170,100',
      viewBox: '0 0 200 200'
    }
  ];

  const demos = {
    shapes: { title: 'Basic Shapes', data: basicShapes },
    timing: { title: 'Time & Calendar', data: timingShapes },
    ui: { title: 'UI Elements', data: uiShapes },
    status: { title: 'Status Icons', data: statusShapes },
    work: { title: 'Work Related', data: workShapes }
  };

  return (
    <div className={`min-h-screen p-6 ${bg.primary}`}>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className={`text-4xl font-bold ${text.primary} mb-2`}>
            🎨 Flubber SVG Morphing Demo
          </h1>
          <p className={`text-lg ${text.secondary}`}>
            Smooth SVG path transitions with Flubber interpolation
          </p>
        </div>

        {/* Demo Category Selector */}
        <div className="flex flex-wrap justify-center gap-3">
          {Object.entries(demos).map(([key, demo]) => (
            <button
              key={key}
              onClick={() => setSelectedDemo(key)}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 ${
                selectedDemo === key
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                  : isDarkMode
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-white text-gray-700 hover:bg-gray-100 shadow-md'
              }`}
            >
              {demo.title}
            </button>
          ))}
        </div>

        {/* Main Demo Area */}
        <div className={`${bg.secondary} rounded-xl p-8 border ${border.primary} shadow-xl`}>
          <h2 className={`text-2xl font-semibold ${text.primary} mb-6 text-center`}>
            {demos[selectedDemo].title}
          </h2>
          
          <div className="flex justify-center">
            <MorphingSVG
              shapes={demos[selectedDemo].data}
              duration={800}
              autoPlay={true}
              autoPlayInterval={3000}
              width={280}
              height={280}
              fill={isDarkMode ? '#60A5FA' : '#3B82F6'}
              strokeWidth={0}
              className={`bg-gradient-to-br ${isDarkMode ? 'from-gray-900 to-gray-800' : 'from-blue-50 to-purple-50'} rounded-xl p-8`}
            />
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`${bg.secondary} rounded-lg p-6 border ${border.primary}`}>
            <div className="flex items-center space-x-3 mb-3">
              <div className={`w-10 h-10 rounded-full ${isDarkMode ? 'bg-blue-900' : 'bg-blue-100'} flex items-center justify-center`}>
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className={`text-lg font-semibold ${text.primary}`}>Smooth Transitions</h3>
            </div>
            <p className={`text-sm ${text.secondary}`}>
              Flubber creates smooth interpolations between SVG paths, handling complex shapes with ease.
            </p>
          </div>

          <div className={`${bg.secondary} rounded-lg p-6 border ${border.primary}`}>
            <div className="flex items-center space-x-3 mb-3">
              <div className={`w-10 h-10 rounded-full ${isDarkMode ? 'bg-purple-900' : 'bg-purple-100'} flex items-center justify-center`}>
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className={`text-lg font-semibold ${text.primary}`}>Auto Play</h3>
            </div>
            <p className={`text-sm ${text.secondary}`}>
              Automatic cycling through shapes with customizable intervals and durations.
            </p>
          </div>

          <div className={`${bg.secondary} rounded-lg p-6 border ${border.primary}`}>
            <div className="flex items-center space-x-3 mb-3">
              <div className={`w-10 h-10 rounded-full ${isDarkMode ? 'bg-green-900' : 'bg-green-100'} flex items-center justify-center`}>
                <span className="text-2xl">🎨</span>
              </div>
              <h3 className={`text-lg font-semibold ${text.primary}`}>Customizable</h3>
            </div>
            <p className={`text-sm ${text.secondary}`}>
              Control colors, sizes, animations, and easing functions for perfect UI integration.
            </p>
          </div>
        </div>

        {/* Code Example */}
        <div className={`${bg.secondary} rounded-lg p-6 border ${border.primary}`}>
          <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>Usage Example</h3>
          <pre className={`${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'} p-4 rounded-lg overflow-x-auto text-sm`}>
            <code className={text.primary}>
{`<MorphingSVG
  shapes={[
    { name: 'Circle', path: 'M100,50 A50,50 0 1,1 100,150...', viewBox: '0 0 200 200' },
    { name: 'Square', path: 'M50,50 L150,50...', viewBox: '0 0 200 200' }
  ]}
  duration={800}
  autoPlay={true}
  autoPlayInterval={3000}
  width={200}
  height={200}
  fill="#3B82F6"
/>`}
            </code>
          </pre>
        </div>

        {/* Features List */}
        <div className={`${bg.secondary} rounded-lg p-6 border ${border.primary}`}>
          <h3 className={`text-lg font-semibold ${text.primary} mb-4`}>Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              '✨ Smooth path interpolation using Flubber',
              '🎬 Auto-play with customizable intervals',
              '🎨 Theme-aware colors',
              '⚡ Optimized performance with requestAnimationFrame',
              '🔄 Manual shape selection',
              '📱 Responsive and accessible',
              '⏱️ Customizable animation duration',
              '🎯 Easing functions for natural motion'
            ].map((feature, idx) => (
              <div key={idx} className={`flex items-center space-x-2 ${text.secondary}`}>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlubberDemo;
