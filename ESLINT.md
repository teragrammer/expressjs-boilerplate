# ESLint Configuration

This document describes the ESLint setup for the `expressjs-boilerplate` project.

## Why ESLint is used

ESLint statically analyzes the TypeScript/JavaScript code to catch bugs, enforce
consistent style, and prevent common mistakes before runtime. It complements the
TypeScript compiler (`tsc`) by enforcing code-quality and best-practice rules that
the type system alone cannot express (e.g. unused variables, equality checks,
curly braces, `console` usage).

## Installation & configuration

ESLint and its supporting packages are installed as devDependencies:

- `eslint` (v10) — core linter.
- `@eslint/js` — official recommended rule set (`js.configs.recommended`).
- `@typescript-eslint/parser` — parses TypeScript for ESLint.
- `@typescript-eslint/eslint-plugin` — TypeScript-specific rules.
- `globals` — standard global variable definitions (Node.js).

Configuration lives in the flat-config file at the project root:

- `eslint.config.mjs`

ESLint 10 uses the **flat config** format exclusively; the legacy `.eslintrc.*`
files are no longer supported.

## Purpose of the configuration file

`eslint.config.mjs` defines, in order:

1. **Global ignores** — `node_modules`, `dist`, `build`, `coverage`, `.vitest`,
   `.git`, load-test reports, and all `*.d.ts` files.
2. **Base recommended rules** — `js.configs.recommended` for all files.
3. **TypeScript rules** — applied to `**/*.ts` / `**/*.tsx`: the
   `@typescript-eslint` plugin with its `flat/recommended` preset plus project
   overrides (see below).
4. **Test-file overrides** — relaxes `no-explicit-any`, `no-unused-vars`, and
   `no-console`, and injects the Vitest globals (`describe`, `it`, `expect`,
   `vi`, `beforeAll`, etc.) so spec files lint cleanly.
5. **Plain JS/MJS/CJS files** — base recommended rules with Node globals.

## Enabled plugins, parsers, and important rules

- **Parser:** `@typescript-eslint/parser` (ES2022+ syntax, ESM source type).
- **Plugins:** `@typescript-eslint`.
- **Important rules (errors):** `eqeqeq`, `curly`, `no-var`, `prefer-const`,
  `no-duplicate-imports`, `no-debugger`, `@typescript-eslint/no-require-imports`,
  and `preserve-caught-error` (thrown errors must attach `{ cause }`).
- **Important rules (warnings):** `no-console`, `@typescript-eslint/no-unused-vars`,
  `@typescript-eslint/no-explicit-any`, `@typescript-eslint/ban-ts-comment`.
- **Disabled (with rationale):** `@typescript-eslint/consistent-type-imports` and
  `@typescript-eslint/explicit-function-return-type` are off to avoid large,
  low-value churn across the existing codebase. They can be re-enabled later.

## How to run lint checks

```bash
npm run lint
```

Runs ESLint against the entire project. Exits `0` when there are no errors
(warnings are reported but do not fail the run).

## How to automatically fix linting issues

```bash
npm run lint:fix
```

Applies all auto-fixable rules (formatting, curly braces, etc.). Review the diff
afterwards, since some fixes require manual follow-up.

## Interpreting and resolving common linting errors

- **`curly`** — wrap single-statement `if`/`for`/`while` bodies in braces.
- **`no-duplicate-imports`** — merge multiple import statements from the same
  module into one.
- **`preserve-caught-error`** — when re-throwing inside `catch`, pass the original
  error as `{ cause: error }`.
- **`no-undef` (NodeJS)** — the `NodeJS` namespace is declared as a global in
  the config; if a new Node type is missing, add it to `globals` in
  `eslint.config.mjs`.
- **`@typescript-eslint/no-unused-vars`** — prefix intentionally unused
  parameters/variables with `_`.
- **`@typescript-eslint/no-explicit-any`** — replace `any` with a concrete type or
  `unknown` where feasible.

## Customizing or extending the configuration

- Add new rules under the TypeScript block in `eslint.config.mjs`.
- To enable type-aware rules (e.g. `no-floating-promises`), add
  `parserOptions.project: './tsconfig.json'` and extend with the
  `flat/recommended-type-checked` preset. This requires the TS project to
  type-check cleanly and is slower.
- To add plugins (e.g. `eslint-plugin-import`, `eslint-plugin-security`), install
  them as devDependencies and register them in the `plugins` object.

## Common usage commands

```bash
npm run lint            # check all supported files
npm run lint:fix        # auto-fix fixable issues
npx eslint src/path.ts  # lint a single file
npx eslint . --max-warnings 0   # fail on any warning (strict mode)
```
