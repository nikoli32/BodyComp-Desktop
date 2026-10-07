# BodyComp Desktop

The Windows desktop edition is a local-first Electron app, separate from the hosted web application. Desktop-only changes here do not alter the web deployment.

The renderer loads packaged files and calls a narrow Electron IPC bridge. SQLite and migrations run in the Electron main process; there is no local HTTP listener, server process, or network account service. The database is stored under Electron's per-user data directory at `%APPDATA%\bodycomp-desktop` on Windows.

The app uses Electron 44's bundled `node:sqlite` runtime and has integration coverage for migrations, persistence, profile isolation, and backups. Node currently marks this API Release Candidate; review its status and behavior before each Store release.

## Development

Requirements: Node.js 22.12 or newer and npm. Run `npm install`, then `npm run desktop:dev`. The app works offline after installation. Run `npm test` for SQLite persistence, profile isolation, validation, and backup/restore tests.

The database is created and migrated on first launch. In Settings, users can export an encrypted full-profile backup or restore one after validation and confirmation. The live database must stay in the app-data folder; a user may choose a OneDrive or other synced folder for backup files only.

## Release

The current Windows Store and direct-build procedures, release gates, and privacy notes are in [STORE_DEPLOYMENT.md](STORE_DEPLOYMENT.md). The Forge MSIX maker is currently experimental; validate each toolchain update and package on a clean Windows install before submission. Store publisher identity, signing credentials, listing assets, and certification are not configured in this repository.
