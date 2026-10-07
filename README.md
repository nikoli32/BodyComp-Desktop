# BodyComp Desktop

The Windows desktop edition is developed in this repository, separate from the hosted web application. Desktop-only changes here do not alter the web deployment.

## Current status

The Electron app serves the existing UI and API from a loopback-only local service. User accounts, workouts, body-composition measurements, and catalog data are stored in SQLite under Electron's per-user application-data folder. The app does not require Wi-Fi or PostgreSQL at runtime.

This is an implementation build, not yet a Store-ready release. MSIX identity, Store listing materials, and certification remain to be configured. Electron 39 bundles Node 22.22, where `node:sqlite` is still marked experimental; that runtime choice must be reviewed before release.

## Development

Requirements: Node.js 22.13 or newer.

1. Run `npm install` from the repository root.
2. Run `npm install` from `backend`.
3. Run `npm run desktop:dev` from the repository root.

The API database is created and migrated automatically. During direct backend development it is stored in `backend/data`; Electron sets the path to its per-user application-data directory. On Windows, the packaged app data is under `%APPDATA%\bodycomp-desktop`.

Electron binds the API to `127.0.0.1`, denies new windows and off-origin navigation, disables renderer Node integration, and enables context isolation and sandboxing.

## Tests

- `npm test`
- `npm run test:backend`
- `npm run check:backend`

The backend integration test uses a temporary database and verifies multiple-profile isolation and persistence after restart. The original web repository remains independent; port shared UI fixes deliberately between repositories.
