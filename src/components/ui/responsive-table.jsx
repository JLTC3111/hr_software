import { cn } from '@/lib/utils';
import { COL_FALLBACK } from '../../utils/tableColumns.js';

/**
 * Scroll container for a data table. Keeps overflow local so the page itself
 * never scrolls sideways, and bleeds to the container edge on phones so the
 * usable width is not eaten by section padding.
 *
 * Pair with the COL priority classes in utils/tableColumns.js.
 */
export const TableScroll = ({ className, children, ...props }) => (
  <div
    className={cn('-mx-2 overflow-x-auto px-2 sm:mx-0 sm:px-0', className)}
    {...props}
  >
    {children}
  </div>
);

/**
 * Label/value pair rendered inside a row's primary cell, standing in for a
 * column the current viewport has hidden. `showUntil` must match the COL tier
 * used on that column, so the value appears exactly when the column does not.
 */
export const StackedDetail = ({ showUntil = 'md', label, value, className }) => {
  if (value === null || value === undefined || value === '') return null;

  return (
    <span
      className={cn(
        'mt-0.5 flex items-baseline gap-1 text-xs font-normal opacity-70',
        COL_FALLBACK[showUntil] ?? COL_FALLBACK.md,
        className
      )}
    >
      <span>{label}:</span>
      <span className="font-medium">{value}</span>
    </span>
  );
};
