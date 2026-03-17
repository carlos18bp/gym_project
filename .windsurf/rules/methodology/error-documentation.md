---
trigger: model_decision
description: Error documentation and known issues tracking. Reference when debugging, fixing bugs, or encountering recurring issues.
---

# Error Documentation — GymProject

This file tracks known errors, their context, and resolutions. When a reusable fix or correction is found during development, document it here to avoid repeating the same mistake.

---

## Format

```
### [ERROR-NNN] Short description
- **Date**: YYYY-MM-DD
- **Context**: Where/when this error occurs
- **Root Cause**: Why it happens
- **Resolution**: How to fix it
- **Files Affected**: List of files
```

---

## Known Issues

### [ISSUE-001] Backup composable file left in codebase
- **Date**: 2026-03-17 (discovered during deep-dive)
- **Context**: `frontend/src/composables/document-variables/useDocumentPermissions_backup.js` exists alongside the actual `useDocumentPermissions.js`
- **Root Cause**: Leftover from a refactor — developer created backup before editing, never cleaned up
- **Resolution**: Safe to delete `useDocumentPermissions_backup.js`. Verify no imports reference it first: `grep -r "useDocumentPermissions_backup" frontend/src/`
- **Files Affected**: `frontend/src/composables/document-variables/useDocumentPermissions_backup.js`

### [ISSUE-002] Empty check_tags.py in backend root
- **Date**: 2026-03-17 (discovered during deep-dive)
- **Context**: `backend/check_tags.py` is 0 bytes — serves no purpose
- **Root Cause**: Likely a debugging/scratch file that was committed accidentally
- **Resolution**: Safe to delete
- **Files Affected**: `backend/check_tags.py`

### [ISSUE-003] Unbounded debug.log growth
- **Date**: 2026-03-17 (discovered during deep-dive)
- **Context**: `backend/debug.log` is 6.7MB and growing. Logging config uses `WatchedFileHandler` without rotation. File is already in `.gitignore` (not a git issue).
- **Root Cause**: No log rotation configured in `settings.py` LOGGING config
- **Resolution**: Switch to `RotatingFileHandler` with `maxBytes` and `backupCount`, or configure system-level logrotate
- **Files Affected**: `backend/gym_project/settings.py` (LOGGING config)

---

## Resolved Issues

_None yet._
