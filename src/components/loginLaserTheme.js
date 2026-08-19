/**
 * Login background palette, derived from the Industry tokens.
 *
 * The login screen was re-skinned onto the Industry system (flat, zero radius,
 * hairline rules, blue accent). The decorative background is kept — it is the
 * one place in the app that gets an atmospheric layer — but it is tuned to the
 * same token set as the card in front of it rather than carrying its own
 * unrelated palette. Concretely:
 *
 *   - `clearColor` / `surfaceBackground` are the page ground, so the canvas is
 *     invisible until the beam and dot field draw on it. If the decoration
 *     never loads, the page looks the same minus the motion.
 *   - The beam and dots use the accent ramp, so the background reads as the
 *     same drawing as the blueprint grid rather than a second design.
 *   - The light set carries no beam at all. On a near-white ground a volumetric
 *     beam is either invisible or dirt; the dot field alone is the restrained
 *     reading the system asks for.
 */

const DOT_FIELD_INTENSITY = {
  dotRadius: 2,
  dotSpacing: 13,
  cursorRadius: 480,
  bulgeStrength: 78,
  glowRadius: 120,
  sparkle: false,
  waveAmplitude: 2,
  waveSpeed: 0.025,
  waveFrequency: 0.03,
};

/** Pointer-less devices get a slow drift instead of a cursor-driven bulge. */
export const DOT_FIELD_AUTO = {
  waveAmplitude: 2.8,
  waveSpeed: 0.055,
  waveFrequency: 0.048,
};

/** `#rrggbb` -> `rgba(r, g, b, alpha)`, so one accent token can carry several weights. */
const withAlpha = (hex, alpha) => {
  const value = hex.replace('#', '');
  const int = parseInt(
    value.length === 3 ? value.replace(/(.)/g, '$1$1') : value,
    16,
  );
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
};

/**
 * Background props for the current theme.
 *
 * @param {ReturnType<import('../theme/industry.js').getIndustry>} ind
 */
export const getLoginLaserTheme = (ind) =>
  ind.dark
    ? {
      horizontalBeamOffset: 0.1,
      verticalBeamOffset: -0.2,
      color: ind.accentDeep,
      clearColor: ind.ground,
      fogIntensity: 0.4,
      beamIntensity: 0.85,
      revealOpacity: 0.4,
      revealBlendMode: 'lighten',
      showSurfacePanel: true,
      surfaceBackground: ind.ground,
      dotField: {
        ...DOT_FIELD_INTENSITY,
        gradientFrom: withAlpha(ind.accentDeeper, 0.52),
        gradientTo: withAlpha(ind.accent, 0.4),
        glowColor: ind.ground,
        glowCenterOpacity: 0.35,
      },
    }
    : {
      horizontalBeamOffset: 0.1,
      verticalBeamOffset: -0.2,
      color: ind.accent,
      clearColor: ind.ground,
      fogIntensity: 0,
      beamIntensity: 0,
      revealOpacity: 0,
      revealBlendMode: 'multiply',
      showSurfacePanel: true,
      surfaceBackground: ind.ground,
      dotField: {
        ...DOT_FIELD_INTENSITY,
        gradientFrom: withAlpha(ind.accent, 0.55),
        gradientTo: withAlpha(ind.accentDeeper, 0.34),
        glowColor: ind.ground,
        glowCenterOpacity: 0.45,
      },
    };
