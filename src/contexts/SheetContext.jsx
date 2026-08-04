/**
 * The sheet a screen is currently drawing.
 *
 * The header is no longer generic chrome: it states which sheet of the ledger
 * you are looking at (number, title, period, figures) and carries that sheet's
 * one primary action. Only the screen knows those things, so the screen
 * publishes them and the header renders them.
 *
 * Anything a page does not publish falls back to a route default in header.jsx,
 * so a screen that has not been wired up still states its own sheet number.
 */
import _React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const SheetContext = createContext(null);

export const SheetProvider = ({ children }) => {
  const [sheet, setSheet] = useState(null);
  const value = useMemo(() => ({ sheet, setSheet }), [sheet]);
  return <SheetContext.Provider value={value}>{children}</SheetContext.Provider>;
};

const NOOP_SHEET = { sheet: null, setSheet: () => {} };

/** Read the published sheet. Safe outside a provider — the header just falls back. */
export const useSheet = () => useContext(SheetContext) ?? NOOP_SHEET;

/**
 * Publish this screen's sheet.
 *
 * `deps` is the caller's, exactly as with useMemo: the sheet object is rebuilt
 * and republished whenever they change. The cleanup clears the sheet, so
 * navigating away drops straight back to the route default rather than leaving
 * the previous page's figures stranded in the header.
 *
 * @param {() => object} build
 * @param {Array} deps
 */
export function usePublishSheet(build, deps) {
  const { setSheet } = useSheet();
  useEffect(() => {
    setSheet(build());
    return () => setSheet(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default SheetContext;
