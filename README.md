# Factory Management Software

## Prerequisites

- Node.js 18 or newer
- npm (comes with Node.js)

## Run Locally

From the project root, run these commands in this exact order:

```bash
npm i
npx prisma migrate dev
npx prisma generate
npm run dev
```

## Notes

- Keep the terminal open while development server is running.
- If Prisma asks for migration details, follow the prompts and continue.
- Re-run Prisma commands after schema changes.
