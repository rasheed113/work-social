import { mkdir, copyFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { constants } from 'node:fs';

const root = process.cwd();
const candidates = [
  join(root, 'node_modules/@wllama/wllama/esm/wasm/wllama.wasm'),
  join(root, 'node_modules/@wllama/wllama/wasm/wllama.wasm'),
];
const source = await firstExisting(candidates);
if (!source) throw new Error('WLLAMA_WASM_ASSET_MISSING: installed @wllama/wllama package contains no bundled WASM runtime.');
const destination = join(root, 'public/wllama/wllama.wasm');
await mkdir(join(root, 'public/wllama'), { recursive: true });
await copyFile(source, destination);
console.log(`Prepared bundled wllama WASM asset at ${destination}`);

async function firstExisting(paths) {
  for (const path of paths) {
    try { await access(path, constants.R_OK); return path; } catch { /* try next */ }
  }
  return null;
}
