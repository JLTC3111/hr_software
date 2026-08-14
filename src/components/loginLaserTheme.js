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

export const DOT_FIELD_AUTO = {
  waveAmplitude: 2.8,
  waveSpeed: 0.055,
  waveFrequency: 0.048,
};

export const LOGIN_LASER_THEME = {
  dark: {
    horizontalBeamOffset: 0.1,
    verticalBeamOffset: -0.2,
    color: '#CF9EFF',
    clearColor: '#000000',
    fogIntensity: 0.45,
    beamIntensity: 1,
    revealOpacity: 0.48,
    revealBlendMode: 'lighten',
    showSurfacePanel: true,
    surfaceBackground: '#000000',
    dotField: {
      ...DOT_FIELD_INTENSITY,
      gradientFrom: 'rgba(255, 255, 255, 0.58)',
      gradientTo: 'rgba(207, 158, 255, 0.45)',
      glowColor: '#000000',
      glowCenterOpacity: 0.35,
    },
  },
  light: {
    horizontalBeamOffset: 0.1,
    verticalBeamOffset: -0.2,
    color: '#2563EB',
    clearColor: '#F1F5F9',
    fogIntensity: 0,
    beamIntensity: 0,
    revealOpacity: 0,
    revealBlendMode: 'multiply',
    showSurfacePanel: true,
    surfaceBackground: '#F1F5F9',
    dotField: {
      ...DOT_FIELD_INTENSITY,
      gradientFrom: 'rgba(37, 99, 235, 0.55)',
      gradientTo: 'rgba(51, 65, 85, 0.38)',
      glowColor: 'rgb(241, 245, 249)',
      glowCenterOpacity: 0.45,
    },
  },
};
