# Codex Project Notes

This file preserves context between sessions. Update as needed.

## Project Overview
- Electron desktop app with Express backend and React frontend.
- Prisma + SQLite for database.
- Backend lives in `electron/server`.
- Frontend lives in `src/app`.

## Database + Prisma
- Prisma schema: `prisma/schema.prisma`
- Prisma client: `@prisma/client`
- Dev DB file: `prisma/dev.db`
- The old `todo.db` was removed.

### Important
The Electron Prisma client uses **different DBs in dev vs packaged**:
- Dev: `prisma/dev.db`
- Packaged: `userData/factory.db`

File: `electron/server/prisma.js`

### Common Fix Commands
```bash
npx prisma migrate dev --name init
npx prisma generate
```

## Runtime Wiring
- Electron starts Express server in `electron/main.js`.
- IPC bridge: `electron/ipc/handlers.js` with `api:request`.
- Renderer uses `window.api.request` exposed in `electron/preload.js`.

## Recent Fixes
- Fixed Prisma relation between `ExpenseEntry` and `LaborAdvance`:
  - Removed `expenseEntryId` from `LaborAdvance`.
  - Added back-relation `expenses` in `LaborAdvance`.
  - Updated backend controllers to use `laborAdvanceId`.
- Added backend update/delete endpoints across parties, expenses, labor, bills, purchases.
- Updated frontend to use backend APIs for create/edit/delete.
- Dashboard now uses live backend data.
- Radix Select error fixed by using `"none"` sentinel instead of empty string for “No unit”.

## Known Commands
- Start dev: `npm run dev`
- Prisma generate: `npx prisma generate`
- Prisma migrate: `npx prisma migrate dev --name init`

## Files Touched Often
- Backend API: `electron/server/controllers/*`
- Backend routes: `electron/server/routes/*`
- Prisma client config: `electron/server/prisma.js`
- Frontend API client: `src/app/lib/api.ts`
- Frontend screens: `src/app/components/*`
