import React, { useState, useCallback, memo } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { cn } from '@/lib/utils'
import { SlidingNumber, Spotlight } from './motion-primitives'
import { useNumberReplay } from './motion-primitives/sliding-number'
import { BorderBeam } from './ui/border-beam'

const parseNumericValue = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { number: value, suffix: '' };
  }

  if (typeof value === 'string') {
    const match = value.trim().match(/^(-?[\d,]+(?:\.\d+)?)\s*(.*)$/);
    if (match) {
      const number = Number(match[1].replace(/,/g, ''));
      if (Number.isFinite(number)) {
        return { number, suffix: match[2] || '' };
      }
    }
  }

  return null;
};

const StatsCard = memo(({ title, value, icon: Icon, staticIcon: StaticIcon, color, size, onClick, isDarkMode, iconProps = {}, staticIconProps = {}, iconHoverOnly = false }) => {
  const { bg, text, border } = useTheme();
  const [isHovering, setIsHovering] = useState(false);
  const { replayToken, bump } = useNumberReplay();

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
    bump();
  }, [bump]);
  const handleMouseLeave = useCallback(() => setIsHovering(false), []);

  const renderIcon = (Component, { withDarkMode = false, extraProps = {} } = {}) => {
    if (!Component) return null;
    const shared = { className: 'h-6 w-6 m-2', color, size, ...extraProps };
    if (withDarkMode) {
      return <Component {...shared} isDarkMode={isDarkMode} />;
    }
    return <Component {...shared} aria-hidden="true" />;
  };

  const animatedValue = parseNumericValue(value);

  return (
    <div
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        bg.secondary,
        'group relative overflow-hidden p-6 rounded-xl shadow-sm border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 scale-in',
        border.primary,
        onClick && 'cursor-pointer'
      )}
    >
      <Spotlight
        className={cn(
          isDarkMode ? 'bg-white/10' : 'bg-sky-500/10',
          'from-sky-400 via-sky-400 to-sky-400'
        )}
        size={180}
      />
      <BorderBeam
        showOnHover
        size={90}
        duration={8}
        borderWidth={2}
        colorFrom={isDarkMode ? '#38bdf8' : '#0ea5e9'}
        colorTo={isDarkMode ? '#2dd4bf' : '#14b8a6'}
      />
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium ${text.secondary} transition-colors duration-200`}>{title}</p>
          <div className={`text-2xl font-bold ${text.primary} transition-all duration-200 group-hover:scale-105`}>
            {animatedValue ? (
              <>
                <SlidingNumber
                  value={animatedValue.number}
                  replayToken={replayToken}
                  className={text.primary}
                />
                {animatedValue.suffix}
              </>
            ) : (
              value
            )}
          </div>
        </div>
        <div className="transition-transform duration-300 group-hover:scale-110">
          {(!iconHoverOnly || isHovering) && Icon ? (
            renderIcon(Icon, { withDarkMode: true, extraProps: iconProps })
          ) : StaticIcon ? (
            renderIcon(StaticIcon, { extraProps: staticIconProps })
          ) : Icon ? (
            renderIcon(Icon, { withDarkMode: true, extraProps: iconProps })
          ) : null}
        </div>
      </div>
    </div>
  );
});

StatsCard.displayName = 'StatsCard';

export default StatsCard;
