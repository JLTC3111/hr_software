/**
 * "Industry" design tokens — the flat, zero-radius, hairline-ruled system used by
 * the Organization Overview screen (direction 1b, "Control rail").
 *
 * Rules the tokens encode, so callers do not have to remember them:
 *   - Radius is 0 everywhere. There is no radius token on purpose.
 *   - Cards are outlines, never fills. The only solid object on the board is the
 *     primary button (and the active rail item).
 *   - Status reads through weight and rule, never through red/green.
 *
 * The light set is the canonical spec. The dark set re-uses the app's existing
 * dark theme temperature so the global toggle keeps working on this screen.
 */

const LIGHT = {
  dark: false,

  // Grounds
  ground: '#f2f2f3',       // page
  chrome: '#eeeef0',       // rail + decision column
  raised: '#f2f2f3',       // inside a blueprint frame (frames are outlines, not fills)

  // Ink
  ink: '#1d1f20',
  inkMuted: 'rgba(29,31,32,.55)',
  inkFaint: 'rgba(29,31,32,.4)',
  inkGhost: 'rgba(29,31,32,.6)',

  // Rules
  hairline: 'rgba(29,31,32,.16)',
  rule: 'rgba(29,31,32,.10)',
  hover: 'rgba(29,31,32,.06)',

  // Ticker
  tickerBg: '#1d2d3d',
  tickerInk: '#f2f2f3',
  tickerRule: 'rgba(242,242,243,.18)',
  tickerUp: '#94bce3',

  // Accent
  accent: '#5980a6',
  accentInk: '#f2f2f3',        // text on top of accent
  accentDeep: '#416180',
  accentDeeper: '#2c455d',
  accentWash: 'rgba(89,128,166,.08)',   // the one tinted card
  accentFill: 'rgba(89,128,166,.12)',   // area chart fill

  // Ramp for ranked bars — index 0 is rank 1
  ramp: ['#5980a6', '#749dc4', '#94bce3', '#b5d9fd', '#c9e3ff', '#d9ecff', '#e6f3ff'],
};

const DARK = {
  dark: true,

  ground: '#15181b',
  chrome: '#1b1f23',
  raised: '#15181b',

  ink: '#e9ebed',
  inkMuted: 'rgba(233,235,237,.55)',
  inkFaint: 'rgba(233,235,237,.4)',
  inkGhost: 'rgba(233,235,237,.6)',

  hairline: 'rgba(233,235,237,.18)',
  rule: 'rgba(233,235,237,.12)',
  hover: 'rgba(233,235,237,.07)',

  tickerBg: '#16232f',
  tickerInk: '#f2f2f3',
  tickerRule: 'rgba(242,242,243,.18)',
  tickerUp: '#94bce3',

  accent: '#749dc4',
  accentInk: '#12171c',
  accentDeep: '#94bce3',
  accentDeeper: '#b5d9fd',
  accentWash: 'rgba(116,157,196,.12)',
  accentFill: 'rgba(116,157,196,.16)',

  // On dark the ramp runs bright → dim so rank 1 still reads loudest.
  ramp: ['#94bce3', '#749dc4', '#5980a6', '#4a6c8c', '#416180', '#375471', '#2c455d'],
};

export const getIndustry = (isDarkMode) => (isDarkMode ? DARK : LIGHT);

/**
 * Fill for a solid button — the one filled object the system allows on a board.
 *
 * `accent` is tuned to read as a tint against the ground: as a chart fill, a
 * rule or a border it is correct, but carrying `accentInk` on top it only
 * reaches 3.7:1 in the light set, under the 4.5:1 AA needs for the button's
 * label. `accentDeep` reaches 5.8:1 and is the same hue. The dark set already
 * clears it at 6.3:1, so there it keeps the standard accent and the button
 * stays consistent with every other accent surface on the screen.
 */
export const solidButtonFill = (ind) => (ind.dark ? ind.accent : ind.accentDeep);

/** Barlow Condensed 600, uppercase — every number and every label on this screen. */
export const DISPLAY = "'Barlow Condensed', 'Barlow', system-ui, sans-serif";
/** Barlow 400 — body copy. */
export const BODY = "'Barlow', system-ui, sans-serif";

/**
 * Kicker: the 10px tracked caps that title a figure.
 */
export const kicker = (color) => ({
  fontFamily: DISPLAY,
  fontWeight: 600,
  fontSize: 10,
  letterSpacing: '.16em',
  textTransform: 'uppercase',
  color,
});

/**
 * A figure number. `size` is the cap height you want.
 */
export const figure = (size, color) => ({
  fontFamily: DISPLAY,
  fontWeight: 600,
  fontSize: size,
  lineHeight: 1,
  letterSpacing: '.01em',
  color,
  fontVariantNumeric: 'tabular-nums',
});

/** Pick the ramp colour for a row at `index` in a ranked list. */
export const rampAt = (ind, index) => ind.ramp[Math.min(index, ind.ramp.length - 1)];
