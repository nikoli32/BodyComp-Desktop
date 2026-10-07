# Windows Store Deployment

## Status and architecture

This repository contains a local Electron desktop foundation and Store packaging configuration; it is not yet a submitted or certified Store release. The current Electron Forge MSIX maker builds `.msix` packages but is marked experimental by its maintainers. Pin the toolchain and validate every update.

The renderer loads packaged files and calls a name-allowlisted, validated `contextBridge`/IPC API. SQLite and migrations run in Electron's main process using its bundled Node `node:sqlite` module. There is no local HTTP listener, backend child process, cloud API, or automatic sync. On Windows, current app data is stored in `%APPDATA%\bodycomp-desktop\bodycomp-v2.sqlite`.

Node's current documentation classifies `node:sqlite` as Stability 1.2, Release Candidate. Electron 44 is pinned and its runtime is exercised by the packaged-app smoke check, but review this API's stability and compatibility before every Store submission/update. If its status or behavior is unsuitable, replace it with a maintained SQLite binding and add the required native build/rebuild prerequisites.

Profiles are local accounts with salted scrypt password hashes. The active profile is local session state and is cleared on logout. Workouts, exercises, measurements, and the weight-unit preference are scoped to the active profile.

The renderer imports the former `bodycomp-weight-unit` browser preference on first settings read when that value remains accessible. A change from a loopback HTTP origin to packaged `file:` pages can make the old browser storage inaccessible; verify the selected unit during upgrade testing.

Legacy data import is deliberately deferred. This release creates and migrates `bodycomp-v2.sqlite`; it does not import records from the earlier PostgreSQL or SQLite stores. The prior `%APPDATA%\bodycomp-desktop\bodycomp.sqlite` is not opened or migrated, and remains available for a later importer. A consistent pre-conversion snapshot was saved under `%LOCALAPPDATA%\BodyComp\migration-backups`. Keep legacy data and the prior app until an import tool is added and verified; users should expect a fresh local profile in this release.

Recovery uses a reconstructed version of the earlier model described in the handoff; it is not an exact source port. For each weighted set, estimated 1RM uses Epley with effective reps `clamp(reps + 10 - RIR, 1, 12)` and missing RIR defaults to 2. Set stimulus is `14 × relativeIntensity × effortFactor × repetitionFactor × loadFactor`, where relative intensity is set weight divided by estimated 1RM, effort factor is `1 + (10 - RIR) / 10`, repetition factor is effective reps divided by 12, and load factor is stored per exercise-muscle assignment (0.1–2.0, default 1.0). Custom-exercise assignments expose this control; starter-catalog assignments currently remain at 1.0. Set and workout-session demands combine multiplicatively, then decay linearly to zero over the recovery duration.

The starting recovery duration is 48 hours and durations are bounded to 18–96 hours. Repeat-exercise transitions compare consecutive estimated 1RMs; after at least three transitions for a muscle, the median observed interval (with a penalty for performance declines) becomes that muscle's learned duration. Readiness is binary: demand at or below 20 is `ready`, otherwise `needs_recovery`. The muscle list and detail view use these statuses and expose the demand, history sample count, last training time, and estimated ready time.

The coefficients, RIR-to-effective-reps conversion, performance-decline penalty, and readiness threshold are explicit reconstruction choices because the legacy implementation source was unavailable in this checkout. Review them against the domain requirements before describing the result as equivalent to the prior model or submitting it as a validated training recommendation.

## Prerequisites

- Windows 10 or 11 development machine with the Windows 10 SDK installed for the MSIX maker.
- Node.js 22.12 or newer and npm. The packaged Electron version is selected in `package.json`; its bundled Node runtime provides `node:sqlite`.
- A Partner Center account and reserved Store identity for a Store submission.
- A publisher certificate for signed local testing or direct distribution. Do not commit certificates, passwords, or Partner Center secrets.

Install, run, and test:

```powershell
npm ci
npm run desktop:dev
npm test
```

The root `postinstall` downloads Electron's runtime. SQLite is created and migrated on first launch.

## MSIX packaging

Electron Forge 8.0.1's MSIX maker is Windows-only, requires the Windows SDK, and is experimental. The development identity and publisher in `forge.config.js` are placeholders and must not be submitted to the Store.

Reserve the product in Partner Center and set the exact identity and publisher values shown there. Set signing inputs through a protected build environment or secret manager:

```powershell
$env:MSIX_IDENTITY_NAME = "<reserved package identity name>"
$env:MSIX_PUBLISHER = "<exact publisher distinguished name>"
$env:MSIX_PUBLISHER_DISPLAY_NAME = "<publisher display name>"
$env:MSIX_PACKAGE_VERSION = "0.1.0.0"
$env:MSIX_WINDOWS_KIT_VERSION = "<installed Windows SDK version>"
$env:MSIX_CERTIFICATE_FILE = "<protected certificate path>"
# Set MSIX_CERTIFICATE_PASSWORD through a secret manager, not source control.
npm run make:windows:x64
```

For ARM64, use `npm run make:windows:arm64`. Set `MSIX_WINDOWS_KIT_VERSION` only to a version installed on the build machine; alternatively set `MSIX_WINDOWS_KIT_PATH` to its Windows Kits directory. MSIX versions are four-part numeric versions and must increase for every submitted update. Forge writes outputs under `out/make`.

The maker currently falls back to default package assets. Before submission, replace or verify app/tile assets, verify manifest identity and capabilities, and validate the package with the Windows SDK and Partner Center. A successful build does not constitute certification.

## Backup, privacy, and data handling

The live database stays outside OneDrive and other synced folders because SQLite WAL files are not safe for continuous file sync. Users choose a destination only when exporting a backup or selecting one to restore. BodyComp does not upload or synchronize records automatically.

Export creates a consistent SQLite snapshot and encrypts it with AES-256-GCM using a key derived from the user's passphrase with scrypt. The passphrase is required to restore and cannot be recovered. Restore validates the backup format, authentication tag, checksum, database integrity, schema version, and foreign keys before asking for confirmation. It then creates a local pre-restore safety snapshot and replaces all local profiles and records. Restored profiles are signed out and require a password again.

The live database is protected by the current Windows user's profile permissions; device encryption such as BitLocker adds protection at rest. Treat backup files as sensitive, choose a strong unique passphrase and a trusted destination, and remember that copying a backup to a synced folder shares it with that provider/account.

Store listing materials and the privacy policy must explain that workout and body-composition data are sensitive, stored locally by default, and included in backups only at the user's request. Disclose local account behavior, backup encryption, the lost-passphrase limitation, retention after uninstall, and network/telemetry behavior accurately. This build has no app telemetry or cloud account service.

## Offline and package verification

Run `npm test`, then verify each release candidate on a clean Windows VM with network access disabled after installation:

- Register and sign in to two profiles; verify neither can access the other's records.
- Create, edit, and delete measurements, custom exercises, and workouts; restart and verify persistence and recovery calculations.
- Change the weight unit, restart, and confirm the preference remains with that profile.
- Export an encrypted backup; verify wrong passphrases, malformed files, unsupported schema versions, and failed restores leave current data unchanged.
- Restore a valid backup, verify the replacement prompt and pre-restore snapshot, sign in again, and verify restored profiles and settings.
- Confirm the packaged process opens local files, opens no listener, and starts no backend process. Verify SQLite and migrations are in the package.
- Install and update the signed MSIX. Confirm `%APPDATA%\bodycomp-desktop\bodycomp-v2.sqlite` persists across updates and the legacy `bodycomp.sqlite` remains unchanged. Test uninstall separately and disclose actual retention behavior.
- Run Windows SDK and Store package validation. Record logs, package hash, architecture, and version for submission notes.

Do not submit until the package has been tested with final publisher identity, signing, icons, privacy text, and the clean-install/update path. A development self-signed package is not a Store submission package.

## Store submission and updates

In Partner Center, complete the app reservation, package identity and publisher settings, age/content questionnaire, privacy policy URL, health/body-data disclosures, Store description, screenshots, icon assets, support contact, pricing, and availability. Upload the validated package and any required `.msixupload` artifact using the current Partner Center flow, respond to certification feedback, and record the result.

After approval, verify the public listing, architectures, install path, first launch, privacy link, and Store-managed update. For each release, increment the app semantic version and four-part MSIX version, retain the same identity and publisher, run offline and migration tests, verify update data retention, and submit the new package.

Reservation, signing ownership, submission, certification responses, and public-listing verification require the publisher's Partner Center access and remain release-owner actions.

## Direct-download distribution

Build direct ZIPs separately with `npm run make:direct:x64` or `npm run make:direct:arm64`. A direct ZIP is not Store-managed: the publisher must sign it appropriately, provide installation/update instructions, distribute updates and security notices, and test supported Windows versions. It does not include Store discovery, Store-managed updates, or Store certification. Keep the same app-data location across upgrades so the local database remains available.
