---
name: Artifact build environment
description: Replit artifact Vite builds depend on service-injected runtime variables.
---

Artifact web builds require the artifact service variables `PORT` and `BASE_PATH`; the managed workflow supplies them, while a bare workspace build may fail before compilation.

**Why:** Imported artifact configs intentionally fail fast when their preview routing variables are absent, which can look like an application build regression even when typechecking and service builds are healthy.

**How to apply:** Verify each artifact with its service variables (or its managed workflow) before changing application code to address a missing-env build failure.