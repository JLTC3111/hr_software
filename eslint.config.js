import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'desktop/app/dist/**', 'release/**', 'HR Console.dc.html']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^[A-Z_]' }],
      // These established modules intentionally expose a provider/component
      // alongside its public hook or configuration. Vite invalidates consumers.
      'react-refresh/only-export-components': ['error', {
        allowConstantExport: true,
        allowExportNames: [
          'useLanguage', 'SUPPORTED_LANGUAGES', 'useTheme', 'useNotifications',
          'useSheet', 'usePublishSheet', 'useUpload', 'useTranslatedText', 'DATE_LOCALES',
          'safeAutofillName', 'cloakAutofillLabel', 'AUTOFILL_OFF_FORM_ATTRS', 'AUTOFILL_OFF_ATTRS',
        ],
      }],
    },
  },
  {
    files: ['scripts/**/*.js', 'tests/**/*.js'],
    languageOptions: { globals: globals.node },
  },
])
