import test from 'node:test';
import assert from 'node:assert/strict';
import { getPasswordResetErrorKey } from '../src/utils/authErrors.js';
import * as authErrors from '../src/utils/authErrors.js';
import * as routes from '../src/config/routes.js';
import * as industry from '../src/theme/industry.js';
import en from '../src/translations/en.js';
import { loadSource } from './helpers/loadSource.js';

test('email quota, request throttling, network and invalid-email failures remain distinct', () => {
  const cases = [
    [{ code: 'over_email_send_rate_limit', status: 429, message: 'email rate limit exceeded' }, 'emailRateLimitError'],
    [{ code: 'over_request_rate_limit', status: 429 }, 'rateLimitError'],
    [{ status: 429 }, 'rateLimitError'],
    [{ name: 'TypeError', message: 'Failed to fetch' }, 'networkError'],
    [{ name: 'AbortError' }, 'networkError'],
    [{ name: 'AuthRetryableFetchError', status: 0 }, 'networkError'],
    [{ code: 'email_address_invalid' }, 'emailInvalid'],
    [{ status: 500, name: 'AuthRetryableFetchError', message: 'internal SMTP details' }, 'error'],
    [null, 'error'],
  ];
  for (const [error, key] of cases) {
    assert.equal(getPasswordResetErrorKey(error), `login.forgotPasswordModal.${key}`);
  }
});

function hooks() {
  const states = [];
  let cursor = 0;
  return {
    reset: () => { cursor = 0; },
    createContext: () => ({ Provider: 'provider' }),
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: initial => {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useRef: value => ({ current: value }),
    useEffect() {},
    useCallback: callback => callback,
    useMemo: factory => factory(),
  };
}

function forgotPasswordAction(error) {
  const react = hooks();
  const requests = [];
  const { AuthProvider } = loadSource('src/contexts/AuthProvider.jsx', {
    './AuthContext.jsx': { AuthContext: react.createContext() },
    react,
    '../config/supabaseClient.js': { supabase: { auth: { async resetPasswordForEmail(email, options) {
      requests.push({ email, options });
      return { error };
    } } } },
    '../utils/sessionHelper.js': {},
    '../utils/demoHelper.js': { isDemoMode: () => false },
    '../utils/activityTracker.js': {},
    '../utils/supabaseTimeout.js': {},
    '../utils/authEvents.js': {},
    '../utils/authErrors.js': authErrors,
    '../config/routes.js': { ...routes, resolvePasswordResetUrl: url => routes.resolvePasswordResetUrl(url, 'https://hr.icue.vn') },
    '../hooks/useSessionKeepAlive.js': { useSessionKeepAlive() {} },
    '../hooks/useIdleLogout.js': { useIdleLogout() {} },
    '../components/idleWarningModal.jsx': { default: 'idle-warning' },
    '../config/requestTimeouts.js': {},
  }, { React: react });
  return { requests, forgotPassword: AuthProvider({ children: null }).props.value.forgotPassword };
}

function find(tree, predicate) {
  if (tree && typeof tree === 'object' && predicate(tree)) return tree;
  for (const child of (Array.isArray(tree) ? tree : tree?.children || [])) {
    const match = find(child, predicate);
    if (match) return match;
  }
  return undefined;
}

test('the actual reset form displays the email quota error instead of the generic failure', async () => {
  const action = forgotPasswordAction({ code: 'over_email_send_rate_limit', status: 429, message: 'email rate limit exceeded' });
  const react = hooks();
  const { default: Login } = loadSource('src/components/login.jsx', {
    react,
    'lucide-react': {},
    '../contexts/AuthContext': { useAuth: () => ({ forgotPassword: action.forgotPassword, isAuthenticated: false }) },
    '../contexts/ThemeContext': { useTheme: () => ({ isDarkMode: false }) },
    '../contexts/LanguageContext': { useLanguage: () => ({ currentLanguage: 'en', t: (key, fallback) => key.split('.').reduce((value, part) => value?.[part], en) || fallback || key }) },
    '../utils/demoHelper': {},
    './themeToggle': {},
    './LanguageSelector': {},
    'react-router-dom': { useNavigate: () => () => {}, useLocation: () => ({ pathname: '/login' }) },
    '../config/routes.js': routes,
    '../config/requestTimeouts.js': {},
    './motion-primitives': {},
    './ui/shimmer-button': { ShimmerButton: 'shimmer-button' },
    './ui/shiny-button': {},
    '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
    './ui/industry.jsx': { Blueprint: 'blueprint' },
    '../theme/industry.js': industry,
    './OptionalLazy.jsx': {},
    './loginLaserTheme.js': { getLoginLaserTheme: () => ({}) },
  }, { window: { matchMedia: () => ({ matches: true }) } });
  const render = () => { react.reset(); return Login(); };
  let screen = render();
  find(screen, node => node.type === 'button' && node.children.includes(en.login.forgotPassword)).props.onClick();
  screen = render();
  let form = find(screen, node => node.type === 'form' && node.props.className === 'space-y-4');
  find(form, node => node.type === 'input' && node.props.type === 'email').props.onChange({ target: { value: 'recovery@example.test' } });
  screen = render();
  form = find(screen, node => node.type === 'form' && node.props.className === 'space-y-4');
  await form.props.onSubmit({ preventDefault() {} });
  screen = render();
  assert.ok(JSON.stringify(screen).includes(en.login.forgotPasswordModal.emailRateLimitError));
  assert.ok(!JSON.stringify(screen).includes(en.login.forgotPasswordModal.error));
  assert.equal(action.requests.length, 1);
  assert.equal(action.requests[0].options.redirectTo, 'https://hr.icue.vn/reset-password');
});
