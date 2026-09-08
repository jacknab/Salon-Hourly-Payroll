---
name: Workspace package links
description: Workspace dependency subpaths need a real install to refresh package symlinks for tooling.
---

When adding a workspace package dependency or export subpath, run a normal pnpm install before validating; `pnpm install --lockfile-only` updates the lockfile but may leave the dependent package's node_modules link absent.

**Why:** Bundlers and TypeScript resolve workspace packages through the dependent package's symlink, not only through the lockfile.

**How to apply:** After package.json or workspace export changes, run pnpm install, then rerun the affected tests and typecheck.