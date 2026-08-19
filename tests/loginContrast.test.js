import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getIndustry, solidButtonFill } from '../src/theme/industry.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

/** WCAG 2.1 relative luminance. */
const channel = (value) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
  const v = hex.replace('#', '');
  const int = parseInt(v.length === 3 ? v.replace(/(.)/g, '$1$1') : v, 16);
  return 0.2126 * channel((int >> 16) & 255)
    + 0.7152 * channel((int >> 8) & 255)
    + 0.0722 * channel(int & 255);
};

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const AA_NORMAL_TEXT = 4.5;

test('the contrast helper agrees with the WCAG reference pairs', () => {
  assert.equal(Math.round(contrast('#ffffff', '#000000')), 21);
  assert.equal(Math.round(contrast('#ffffff', '#ffffff')), 1);
});

test('the solid button label clears AA in both themes', () => {
  for (const isDark of [false, true]) {
    const ind = getIndustry(isDark);
    const ratio = contrast(ind.accentInk, solidButtonFill(ind));
    assert.ok(
      ratio >= AA_NORMAL_TEXT,
      `${isDark ? 'dark' : 'light'}: ${ind.accentInk} on ${solidButtonFill(ind)} is ${ratio.toFixed(2)}:1`,
    );
  }
});

test('the raw accent is why the button needs its own fill', () => {
  // Documents the regression: the light accent behind accentInk is under AA, so
  // a future edit that "simplifies" solidButtonFill back to ind.accent fails.
  const light = getIndustry(false);
  assert.ok(contrast(light.accentInk, light.accent) < AA_NORMAL_TEXT);
  assert.notEqual(solidButtonFill(light), light.accent);
});

test('ShimmerButton merges a caller style instead of dropping its own variables', () => {
  const button = source('src/components/ui/shimmer-button.tsx');

  // The button paints itself with [background:var(--bg)]. When a caller's
  // `style` replaced that object wholesale, --bg went undefined and the button
  // rendered with no background at all — on the login screen that left
  // accentInk text on an identically coloured ground, at 1:1.
  assert.match(button, /"--bg": background,[\s\S]*?\.\.\.style,/);

  // `style` must be destructured out of props, or the spread puts it back.
  assert.match(button, /children,\s*\n\s*style,\s*\n\s*\.\.\.props/);
});

test('the login buttons are filled with the AA-checked colour', () => {
  const login = source('src/components/login.jsx');

  assert.match(login, /const buttonFill = solidButtonFill\(ind\)/);
  assert.doesNotMatch(login, /background=\{ind\.accent\}/);

  const fills = login.match(/background=\{buttonFill\}/g) ?? [];
  assert.equal(fills.length, 2, 'sign-in and send-reset buttons');
});
