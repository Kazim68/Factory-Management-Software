// Uploads the already-built artifacts in release/ to a GitHub Release.
// No rebuild. Reads GH_TOKEN from the environment.
//
// Usage: node scripts/publishRelease.mjs
// Env:   GH_TOKEN=<classic token with repo scope> (required)
//        RELEASE_TAG=v1.0.0 (optional; defaults to v<package.version>)

import { readFileSync, statSync, createReadStream } from 'node:fs';
import { basename, join } from 'node:path';

const OWNER = 'Kazim68';
const REPO = 'Factory-Management-Software';
const RELEASE_DIR = join(process.cwd(), 'release');

const token = process.env.GH_TOKEN;
if (!token) {
  console.error('ERROR: GH_TOKEN is not set. Run:  $env:GH_TOKEN = "ghp_xxx"');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
const version = pkg.version;
const tag = process.env.RELEASE_TAG || `v${version}`;

// Files electron-updater needs. Uses the dash-named artifacts referenced by latest.yml.
const assets = [
  `CrossX-Setup-${version}.exe`,
  `CrossX-Setup-${version}.exe.blockmap`,
  'latest.yml',
];

const api = 'https://api.github.com';
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'crossx-publisher',
};

async function gh(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} on ${url}\n${JSON.stringify(body, null, 2)}`);
  }
  return body;
}

async function getOrCreateRelease() {
  // Try to find an existing release for this tag.
  try {
    const existing = await gh(`${api}/repos/${OWNER}/${REPO}/releases/tags/${tag}`);
    console.log(`Found existing release for ${tag} (id ${existing.id}).`);
    return existing;
  } catch (e) {
    if (!String(e.message).startsWith('404')) throw e;
  }
  console.log(`Creating release ${tag}...`);
  return gh(`${api}/repos/${OWNER}/${REPO}/releases`, {
    method: 'POST',
    body: JSON.stringify({
      tag_name: tag,
      name: tag,
      body: `Release ${tag}`,
      draft: false,
      prerelease: false,
    }),
  });
}

async function deleteExistingAsset(release, name) {
  const found = (release.assets || []).find((a) => a.name === name);
  if (found) {
    console.log(`  Deleting existing asset ${name} (id ${found.id})...`);
    await gh(`${api}/repos/${OWNER}/${REPO}/releases/assets/${found.id}`, { method: 'DELETE' });
  }
}

async function uploadAsset(release, filePath) {
  const name = basename(filePath);
  const size = statSync(filePath).size;
  const uploadUrl = release.upload_url.replace(/\{.*\}$/, `?name=${encodeURIComponent(name)}`);
  console.log(`  Uploading ${name} (${(size / 1e6).toFixed(1)} MB)...`);
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(size),
    },
    body: createReadStream(filePath),
    duplex: 'half',
  });
  if (!res.ok) {
    throw new Error(`Upload failed for ${name}: ${res.status} ${res.statusText}\n${await res.text()}`);
  }
  console.log(`  ✓ ${name}`);
}

const release = await getOrCreateRelease();
for (const a of assets) {
  const filePath = join(RELEASE_DIR, a);
  statSync(filePath); // throws if missing
  await deleteExistingAsset(release, a);
  await uploadAsset(release, filePath);
}
console.log(`\nDone. https://github.com/${OWNER}/${REPO}/releases/tag/${tag}`);
