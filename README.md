# Factory Management Software

## Prerequisites

- Node.js 18 or newer
- npm (comes with Node.js)

## Run Locally

From the project root, run these commands in this order:

```bash
npm i
npx prisma migrate dev
npx prisma generate
npm run generate:cloud-prisma
npm run dev
```

## Notes

- Keep the terminal open while development server is running.
- If Prisma asks for migration details, follow the prompts and continue.
- Re-run both generate commands after schema changes:

```bash
npx prisma generate
npm run generate:cloud-prisma
```

## After Pulling Latest Changes

If someone pulls new migrations or Prisma schema changes, run:

```bash
npx prisma migrate dev
npx prisma generate
npm run generate:cloud-prisma
```

## License Server

CrossX requires a running license server before any user can sign in. The
companion project lives at `../license-server/` — see its README for setup.

The Electron app reads the server URL from, in order of precedence:

1. The `LICENSE_SERVER_URL` environment variable.
2. A `license.config.json` next to the installed executable
   (`{ "serverUrl": "https://..." }`).
3. Hard fallback `http://localhost:4100` (matches the license-server's default).

For development, you can point at a locally-running license server with:

```bash
# Windows PowerShell
$env:LICENSE_SERVER_URL = "http://localhost:4100"
npm run dev
```

On first launch the app generates a stable per-device UUID and persists it in
`license.json` inside Electron's `userData` directory. That file holds the
device ID and the bound license key — never delete the device ID portion or the
device will appear "new" to the server and consume an extra slot.
