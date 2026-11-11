// eslint.config.mjs
// Flat configuration (ESLint 9+ / 10). See ESLINT.md for details.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

const vitestGlobals = {
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  vi: 'readonly',
  vitest: 'readonly',
  beforeAll: 'readonly',
  beforeEach: 'readonly',
  afterAll: 'readonly',
  afterEach: 'readonly',
  suite: 'readonly',
  xdescribe: 'readonly',
  xit: 'readonly',
  xtest: 'readonly',
};

export default [
  // ---- Global ignores ----
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '.vitest/**',
      '.git/**',
      'tests/load/reports/**',
      '**/*.d.ts',
      /*
       * Vendored agent skills are not application code: they are
       * installed tooling with their own style and globals.
       */
      '.agents/**',
      '.opencode/**',
    ],
  },

  // ---- Base recommended rules (JS) ----
  js.configs.recommended,

  // ---- TypeScript source & scripts ----
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        NodeJS: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs['flat/recommended'].rules,
      // Core JS rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'curly': ['error', 'all'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-duplicate-imports': 'error',
      'no-unused-vars': 'off',
      // TypeScript-specific
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-require-imports': 'error',
    },
  },

  // ---- Test files (relaxed + vitest globals) ----
  {
    files: ['**/*.spec.ts', '**/*.test.ts', 'tests/**/*.{ts,js}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...vitestGlobals,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-console': 'off',
    },
  },

  // ---- Plain JS/MJS/CJS config & tooling files ----
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-console': 'warn',
    },
  },
];
