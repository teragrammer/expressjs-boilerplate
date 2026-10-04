---
name: auto-commit
description: Safely inspect git status and diffs, group newly created and modified files logically, and write clean conventional commits. Use when committing code changes or after creating new files.
---

# Smart Auto-Commit Skill

Follow these steps strictly whenever a commit action is requested or code changes need to be saved:

## Step 1: Pre-flight Git & Safety Check
1. **Verify Git Identity:** Check `git config user.name` and `git config user.email`.
    - *If missing:* Stop execution immediately and ask the user to configure their identity using:
      `git config --global user.name "Your Name"` and `git config --global user.email "your@email.com"`.
2. **Verify Remote Security:** Inspect `git remote -v`.
    - *If a raw token is exposed in the HTTPS URL (e.g., `https://token@github.com/...`):* Stop execution and recommend switching to **Option 1 (SSH)** for security. Provide the user with this command to fix it securely:
      ```bash
      git remote set-url origin git@github.com:your-username/your-repo.git
      ```
      *(Remind them to ensure their SSH key is added to GitHub/GitLab).*

## Step 2: Inspection & Logical File Grouping
1. **Discover All Changes:** Run `git status` to identify **untracked (newly created)** files as well as modified files.
2. **Analyze Content:**
    - For modified files, run `git diff` to inspect changes.
    - For newly created files, inspect their contents directly.
3. **Group Files Logically:** Do not bundle everything into one messy commit. Group related files into atomic batches:
    - **Database Group:** New/modified Kysely migrations, seeds, or schemas.
    - **Features Group:** Express routes, controllers, and core business logic.
    - **Tests Group:** Vitest test files and mocking utilities.
    - **Configs & Docs Group:** `package.json`, environment templates, or `README.md`.

## Step 3: Staging and Committing per Group
For each logical group identified:
1. Stage only the files belonging to that specific group (`git add <file1> <file2>`).
2. Generate a clear **conventional commit message** that reflects the actual diff contents (e.g., `feat(auth): add JWT middleware and login route` or `test(users): add vitest suite for user creation`).
3. Commit the staged batch (`git commit -m "..."`).