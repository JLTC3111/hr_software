import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource } from './helpers/loadSource.js';
import { getIndustry, BODY, DISPLAY } from '../src/theme/industry.js';

function find(tree, predicate) {
  if (tree && typeof tree === 'object' && predicate(tree)) return tree;
  for (const child of Array.isArray(tree) ? tree : tree?.children || []) {
    const result = find(child, predicate);
    if (result) return result;
  }
}

// Run the real component hooks with a deterministic clock. Browser checks cover
// Motion's rendering and pointer handling; these cover timer and queue races.
function harness(file, props = {}) {
  const slots = [], effects = [], timers = new Map(), listeners = new Map();
  let cursor = 0, now = 0, nextTimer = 0, dirty = false, tree;
  const changed = (a, b) => !a || !b || a.length !== b.length || a.some((value, i) => !Object.is(value, b[i]));
  const react = {
    createElement: (type, attrs, ...children) => ({ type, props: attrs || {}, children }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => {
        const next = typeof value === 'function' ? value(slots[index]) : value;
        if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true; }
      }];
    },
    useRef(initial) { return slots[cursor++] ||= { current: initial }; },
    useCallback(callback, deps) {
      const index = cursor++;
      if (changed(slots[index]?.deps, deps)) slots[index] = { deps, value: callback };
      return slots[index].value;
    },
    useMemo(callback, deps) {
      const index = cursor++;
      if (changed(slots[index]?.deps, deps)) slots[index] = { deps, value: callback() };
      return slots[index].value;
    },
    useEffect(callback, deps) {
      const index = cursor++;
      if (changed(slots[index]?.deps, deps)) effects.push({ index, callback, deps });
    },
  };
  const document = {
    hidden: false, body: {},
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
  };
  const imports = {
    react, 'react-dom': { createPortal: value => value },
    'motion/react': {
      motion: { div: 'motion-div' }, AnimatePresence: 'presence',
      useDragControls: () => ({ start() {} }), useReducedMotion: () => false,
      useMotionValue: initial => react.useRef({ set() {}, get: () => initial }).current,
      useTransform: () => 0,
    },
    'lucide-react': {}, './swipe-toast.css': {},
    '../../contexts/ThemeContext.jsx': { useTheme: () => ({ isDarkMode: false }) },
    '../../contexts/LanguageContext.jsx': { useLanguage: () => ({ t: (_key, fallback) => fallback }) },
    '../../theme/industry.js': { getIndustry, BODY, DISPLAY },
    '../components/ui/swipe-toast.jsx': 'swipe-toast',
    './LanguageContext.jsx': { useLanguage: () => ({ t: (_key, fallback) => fallback }) },
    './ToastContext.js': { ToastContext: { Provider: 'toast-provider' } },
  };
  const module = loadSource(file, imports, {
    document, performance: { now: () => now },
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const Component = module.default || module.ToastProvider;
  const render = () => {
    for (let pass = 0; pass < 20; pass++) {
      cursor = 0; dirty = false;
      tree = Component(props);
      const pending = effects.splice(0);
      for (const effect of pending) slots[effect.index]?.cleanup?.();
      for (const effect of pending) slots[effect.index] = { deps: effect.deps, cleanup: effect.callback() };
      if (!dirty) return tree;
    }
    throw new Error('Unexpected render loop');
  };
  const tick = ms => {
    const end = now + ms;
    for (;;) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      now = next[1].at; timers.delete(next[0]); next[1].callback(); render();
    }
    now = end;
  };
  render();
  return {
    render, tick,
    setProps(next) { Object.assign(props, next); return render(); },
    card: () => find(render(), node => node.props?.['data-swipe-toast'] !== undefined),
    exit: () => find(render(), node => node.type === 'presence').props.onExitComplete(),
    hide(hidden) { document.hidden = hidden; listeners.get('visibilitychange')(); render(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
    pendingTimers: () => timers.size,
  };
}

const component = 'src/components/ui/swipe-toast.jsx';

test('timeout closes once after the exit and clears timers', () => {
  const reasons = [];
  const fixture = harness(component, { title: 'Saved', duration: 1000, onClose: reason => reasons.push(reason) });
  fixture.tick(999);
  assert.ok(fixture.card());
  fixture.tick(1);
  assert.equal(fixture.card(), undefined);
  assert.deepEqual(reasons, []);
  fixture.exit(); fixture.exit();
  assert.deepEqual(reasons, ['timeout']);
  assert.equal(fixture.pendingTimers(), 0);
});

test('hover, focus and background pause the remaining lifetime without restarting it', () => {
  const fixture = harness(component, { title: 'Saved', duration: 1000 });
  fixture.tick(300);
  fixture.card().props.onMouseEnter(); fixture.render(); fixture.tick(5000);
  assert.ok(fixture.card());
  fixture.card().props.onFocusCapture(); fixture.card().props.onMouseLeave(); fixture.render();
  fixture.tick(5000);
  assert.ok(fixture.card(), 'keyboard focus still holds the pause');
  fixture.card().props.onBlurCapture({ currentTarget: { contains: () => false }, relatedTarget: null }); fixture.render();
  fixture.tick(200);
  fixture.hide(true); fixture.tick(5000);
  assert.ok(fixture.card());
  fixture.hide(false); fixture.tick(499);
  assert.ok(fixture.card());
  fixture.tick(1);
  assert.equal(fixture.card(), undefined);
});

test('disabled hover pause and indefinite durations honour the supplied API', () => {
  const timed = harness(component, { duration: 1000, pauseOnHover: false });
  timed.card().props.onMouseEnter(); timed.render(); timed.tick(1000);
  assert.equal(timed.card(), undefined);
  const persistent = harness(component, { duration: 0, closeButton: false, inline: true });
  persistent.tick(600000);
  assert.ok(persistent.card());
  assert.equal(persistent.pendingTimers(), 0);
  assert.equal(find(persistent.render(), node => node.props?.className === 'swipe-toast-close'), undefined);
});

test('short drags resume the timer; crossing the swipe distance dismisses in either direction', () => {
  for (const distance of [-50, 50]) {
    const reasons = [];
    const fixture = harness(component, { duration: 1000, swipeDistance: 40, onClose: reason => reasons.push(reason) });
    fixture.tick(200);
    fixture.card().props.onDragStart(); fixture.render(); fixture.tick(5000);
    fixture.card().props.onDragEnd(null, { offset: { x: 20 } }); fixture.render(); fixture.tick(200);
    assert.ok(fixture.card());
    fixture.card().props.onDragEnd(null, { offset: { x: distance } }); fixture.render(); fixture.exit();
    assert.deepEqual(reasons, ['swipe']);
  }
});

test('an action pauses expiry, rejects duplicate clicks and closes only on success', async () => {
  const gate = Promise.withResolvers(), reasons = [];
  let calls = 0;
  const fixture = harness(component, { title: 'Archived', actionLabel: 'Undo', duration: 1000,
    onAction: () => { calls++; return gate.promise; }, onClose: reason => reasons.push(reason),
  });
  const button = find(fixture.render(), node => node.props?.className === 'swipe-toast-action');
  const pending = button.props.onClick();
  await button.props.onClick();
  fixture.render(); fixture.tick(5000);
  assert.equal(calls, 1);
  assert.ok(fixture.card());
  gate.resolve(); await pending; fixture.render(); fixture.exit();
  assert.deepEqual(reasons, ['action']);
});

test('failed actions keep the toast available for retry', async () => {
  const fixture = harness(component, { title: 'Archived', actionLabel: 'Undo',
    onAction: async () => { throw new Error('Restore failed'); },
  });
  await find(fixture.render(), node => node.props?.className === 'swipe-toast-action').props.onClick();
  assert.ok(fixture.card());
  assert.ok(find(fixture.render(), node => node.props?.role === 'alert'));
});

test('programmatic dismissal wins if an action finishes while the toast is exiting', async () => {
  const gate = Promise.withResolvers(), reasons = [];
  const fixture = harness(component, { title: 'Archived', actionLabel: 'Undo', onAction: () => gate.promise,
    onClose: reason => reasons.push(reason),
  });
  const pending = find(fixture.render(), node => node.props?.className === 'swipe-toast-action').props.onClick();
  fixture.setProps({ open: false });
  gate.resolve(); await pending; fixture.render(); fixture.exit();
  assert.deepEqual(reasons, ['dismiss']);
});

test('controlled reopen gets a fresh lifetime and unmount cancels expiry', () => {
  const reasons = [];
  const fixture = harness(component, { open: true, duration: 1000, onClose: reason => reasons.push(reason) });
  fixture.tick(600);
  fixture.setProps({ open: false }); fixture.exit();
  assert.deepEqual(reasons, ['dismiss']);
  fixture.setProps({ open: true }); fixture.tick(999);
  assert.ok(fixture.card());
  fixture.unmount();
  assert.equal(fixture.pendingTimers(), 0);
});

test('the shared stack queues notifications without dropping messages or leaving dismissed queued items', () => {
  const fixture = harness('src/contexts/ToastProvider.jsx', { maxVisible: 2 });
  const api = fixture.render().props.value;
  const first = api.toast('First');
  api.toast('Second');
  const third = api.toast('Third');
  const fourth = api.toast('Fourth');
  const visible = () => find(fixture.render(), node => node.props?.className === 'swipe-toast-viewport').children[0];
  assert.deepEqual(Array.from(visible(), node => node.props.title), ['First', 'Second']);
  api.dismissToast(third);
  visible()[0].props.onClose('swipe');
  assert.deepEqual(Array.from(visible(), node => node.props.title), ['Second', 'Fourth']);
  api.dismissToast(fourth);
  assert.equal(visible().find(node => node.props.title === 'Fourth').props.open, false);
  api.dismissToast();
  for (const node of visible()) node.props.onClose('dismiss');
  assert.equal(visible().length, 0);
  assert.equal(typeof first, 'number');
});
