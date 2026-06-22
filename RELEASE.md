# CrossX Release & Auto-Update Guide

This document describes how to ship a new CrossX build that the existing
auto-updater on user machines will pick up.

> Update channel: **GitHub Releases**
> Installer: **NSIS (.exe)**
> Updater: **electron-updater**

---

## 1. One-time setup

1. Edit `package.json` → `build.publish[0]` and replace
   `YOUR_GITHUB_OWNER` / `YOUR_GITHUB_REPO` with the real repository.
2. Edit `dev-app-update.yml` with the same `owner` / `repo`.
3. Create a GitHub Personal Access Token with `repo` scope and export it
   in the shell that runs `npm run release`:

   ```powershell
   $env:GH_TOKEN = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   ```

   (CI/CD pipelines should use `GH_TOKEN` from secrets — never commit it.)

4. (Optional) Provide a code-signing certificate via:
   ```powershell
   $env:CSC_LINK = "C:\path\to\cert.pfx"
   $env:CSC_KEY_PASSWORD = "..."
   ```
   Unsigned builds still update, but Windows SmartScreen will warn on
   first install.

---

## 2. Cutting a release

### 2.1 Bump the version

`package.json` is the single source of truth for the version. Use semantic
versioning:

```powershell
npm version patch   # 1.0.0 → 1.0.1  bug fixes
npm version minor   # 1.0.0 → 1.1.0  features
npm version major   # 1.0.0 → 2.0.0  breaking
```

`npm version` commits the change and creates a `vX.Y.Z` git tag. Push the
tag too:

```powershell
git push origin main --follow-tags
```

### 2.2 Build & publish in one shot

```powershell
npm run release
```

This runs:

1. Prisma client generation (local + cloud)
2. Local SQLite template DB generation
3. `vite build` → `dist/`
4. `electron-builder --win --publish always`

`electron-builder` will:

- Produce `release/CrossX Setup <version>.exe`
- Produce `release/latest.yml` (update manifest)
- Produce `release/CrossX Setup <version>.exe.blockmap` (differential updates)
- Create a **draft** GitHub Release named `vX.Y.Z`
- Upload the three artifacts above to that release

### 2.3 Publish the draft

1. Open the repo on GitHub → **Releases**.
2. Find the draft created by electron-builder.
3. Edit release notes (optional — also surfaced inside the app).
4. Click **Publish release**.

The moment the release leaves "draft", every running CrossX instance will
pick the new version up on its next periodic check (≤ 6 hours) or on next
launch.

### 2.4 Manual fallback

If `npm run release` cannot publish (no token, restricted network), use
`build:win` instead and upload artifacts manually:

```powershell
npm run build:win
```

Then upload these three files from `release/` to the GitHub Release:

- `CrossX Setup <version>.exe`
- `latest.yml`
- `CrossX Setup <version>.exe.blockmap`

> **Important:** `latest.yml` MUST be present on the release for
> `electron-updater` to see the new version.

---

## 3. What the user experiences

| Event                          | UI                                                              |
| ------------------------------ | --------------------------------------------------------------- |
| App boots                      | Silent check after ~10 s                                        |
| Every 6 hours                  | Silent background check                                         |
| Update found                   | Background download starts, bottom-right progress banner shows  |
| Download complete              | "Restart now / Remind later" banner                             |
| User clicks **Restart now**    | App quits, NSIS installs new version, app relaunches            |
| Update server unreachable      | Inline banner with error message, retried on next interval      |

---

## 4. Verifying an update flow end-to-end

1. Set the version in `package.json` to `1.0.0`. Run `npm run build:win`.
2. Install `release/CrossX Setup 1.0.0.exe` and launch the app.
3. Bump `package.json` to `1.0.1`. Run `npm run release` (or build & upload
   manually).
4. With the installed 1.0.0 app still running, open the GitHub release in
   your browser to confirm `latest.yml` is present.
5. In the running app, wait for the periodic check or restart the app.
   The bottom-right banner should show downloading progress, then the
   "Restart now" prompt.
6. Click **Restart now** — the app should relaunch on 1.0.1.

Logs are written to:

```
%APPDATA%\CrossX\logs\main.log
```

(Linux/Mac equivalents apply if those targets are added later.)

---

## 5. Version conventions

- Pre-release tags (e.g. `1.1.0-beta.1`) are NOT picked up by users on the
  stable channel by default. Use them sparingly.
- Never re-publish a version. If a release is broken, ship `X.Y.Z+1`
  rather than overwriting `X.Y.Z`.
- The version inside `package.json`, the installer filename, and the git
  tag must all agree.

---

## 6. Troubleshooting

| Symptom                                              | Likely cause / fix                                                                                  |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Banner never appears                                 | App is not packaged (dev mode). Build & install the NSIS exe first.                                 |
| "Update failed: Cannot find latest.yml"              | Forgot to upload `latest.yml` or the release is still in draft.                                     |
| Updater 404 on private repo                          | electron-updater needs a token. For end users use a public repo or a self-hosted generic provider.  |
| SmartScreen warning every install                    | Code-sign the installer (`CSC_LINK` / `CSC_KEY_PASSWORD`).                                          |
| User stuck on old version                            | Check `%APPDATA%\CrossX\logs\main.log` for `[updater]` entries.                                     |
