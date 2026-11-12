#!/usr/bin/env node

/**
 * Restore project skills after a local dependency install.
 *
 * The `prepare` hook also runs during `npm ci` in CI and Docker builds. Skills
 * are cloned from external GitHub repositories, and CI runs the installer with
 * --frozen-lockfile; a fresh checkout without installed skills can fail the
 * lock validation. That work is not needed to install or compile the app, so
 * skip it outside local development.
 */
import { execSync } from 'node:child_process';

if (process.env.CI || process.env.NODE_ENV === 'production') {
  process.exit(0);
}

execSync('npm run setup:skills', { stdio: 'inherit' });
