import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './helpers/loadSource.js';
import { isTranslationEditor } from '../src/utils/translationAccess.js';
import * as queueStatus from '../src/utils/translationQueueStatus.js';
import * as industry from '../src/theme/industry.js';
import english from '../src/translations/en.js';
import additions from '../src/translations/additions/en.js';

function findElement(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (predicate(node)) return node;
  for (const child of Array.isArray(node) ? node : node.children) {
    const match = findElement(child, predicate);
    if (match) return match;
  }
  return undefined;
}

function translationLink({ user, dark, collapsed, hovered }) {
  const activeName = hovered ? 'Translation Studio' : null;
  const states = [collapsed, {}, activeName, activeName];
  let index = 0;
  const react = {
    Fragment: 'fragment', createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (value) => [index < states.length ? states[index++] : value, () => {}],
    useRef: () => ({ current: null }), useEffect() {},
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  };
  const t = (key, fallback) => additions[key] || key.split('.').reduce((value, part) => value?.[part], english) || fallback || key;
  const { default: Sidebar } = loadSource('src/components/sidebar.jsx', {
    react, 'react-router-dom': { NavLink: 'NavLink' }, 'lucide-react': {},
    '../contexts/ThemeContext.jsx': { useTheme: () => ({ isDarkMode: dark }) },
    '../contexts/LanguageContext.jsx': { useLanguage: () => ({ t }) },
    '../contexts/AuthContext.jsx': { useAuth: () => ({ user }) },
    '../contexts/NotificationContext.jsx': { useNotifications: () => ({ unreadCount: 2 }) },
    '../utils/translationAccess.js': { isTranslationEditor },
    '../utils/translationQueueStatus.js': queueStatus,
    '../theme/industry.js': industry,
  });
  return findElement(Sidebar({ isMobileMenuOpen: false, setIsMobileMenuOpen() {} }), ({ props }) => props?.to === '/translations');
}

const badgeFor = (link, isActive) => {
  const body = link.children[0]({ isActive });
  const badge = findElement(body, ({ props }) => props?.translation);
  return badge.type(badge.props);
};

const luminance = (hex) => hex.slice(1).match(/../g).map((component) => Number.parseInt(component, 16) / 255)
  .map((component) => component <= 0.04045 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4)
  .reduce((sum, component, index) => sum + component * [0.2126, 0.7152, 0.0722][index], 0);

test('the translation count renders as an adaptive filled pill with a tooltip in all rail states', () => {
  const user = { id: 'badge-test', role: 'admin' };
  queueStatus.publishTranslationQueueCount(user.id, 103);
  for (const dark of [false, true]) {
    for (const collapsed of [false, true]) {
      for (const hovered of [false, true]) {
        const link = translationLink({ user, dark, collapsed, hovered });
        assert.match(link.props['aria-label'], /Translation Studio · Fields to translate \(103\)/);
        for (const active of [false, true]) {
          const pill = badgeFor(link, active);
          const style = pill.props.style;
          assert.equal(pill.children[0], 103);
          assert.match(pill.props.title, /counted once/);
          assert.equal(style.borderRadius, 999);
          assert.equal(style.justifyContent, 'center');
          assert.equal(style.fontVariantNumeric, 'tabular-nums');
          assert.ok(style.minWidth > 0 && style.paddingInline > 0 && style.width === undefined);
          const [low, high] = [luminance(style.color), luminance(style.background)].sort((a, b) => a - b);
          assert.ok((high + 0.05) / (low + 0.05) >= 4.5, 'pill text has contrast over its own fill');
          assert.equal(style.position, collapsed ? 'absolute' : undefined);
        }
      }
    }
  }
});

test('the sidebar hides zero and listens for unique per-user count changes', () => {
  const user = { id: 'badge-refresh', role: 'admin' };
  const unrelated = { id: 'badge-other', role: 'admin' };
  const seen = [];
  const unsubscribe = queueStatus.subscribeTranslationQueue(() => seen.push(queueStatus.getTranslationQueueCount(user.id)));
  try {
    queueStatus.publishTranslationQueueCount(user.id, 1);
    queueStatus.publishTranslationQueueCount(user.id, 1);
    assert.equal(badgeFor(translationLink({ user }), false).children[0], 1);
    assert.equal(badgeFor(translationLink({ user: unrelated }), false), null);
    queueStatus.publishTranslationQueueCount(user.id, 0);
    assert.deepEqual(seen, [1, 0]);
    assert.equal(badgeFor(translationLink({ user }), false), null);
    assert.equal(translationLink({ user: { ...user, role: 'employee' } }), undefined);
  } finally {
    unsubscribe();
  }
});
