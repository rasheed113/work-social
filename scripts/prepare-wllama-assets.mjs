import { mkdir, copyFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { constants } from 'node:fs';

const root = process.cwd();
const wllamaWasmCandidates = [
  join(root, 'node_modules/@wllama/wllama/esm/wasm/wllama.wasm'),
  join(root, 'node_modules/@wllama/wllama/wasm/wllama.wasm'),
];
const compatCandidates = [
  join(root, 'node_modules/@wllama/wllama-compat/wasm/wllama.wasm'),
  join(root, 'node_modules/@wllama/wllama-compat/wasm/wllama.js'),
];

const wasmSource = await firstExisting(wllamaWasmCandidates);
if (!wasmSource) throw new Error('WLLAMA_WASM_ASSET_MISSING: installed @wllama/wllama package contains no bundled WASM runtime.');

const compatWasmSource = await firstExisting([compatCandidates[0]]);
const compatWorkerSource = await firstExisting([compatCandidates[1]]);
if (!compatWasmSource || !compatWorkerSource) {
  throw new Error('WLLAMA_COMPAT_ASSET_MISSING: installed @wllama/wllama-compat package must provide wasm/wllama.wasm and wasm/wllama.js.');
}

await mkdir(join(root, 'public/wllama'), { recursive: true });
await mkdir(join(root, 'public/wllama-compat'), { recursive: true });
await copyFile(wasmSource, join(root, 'public/wllama/wllama.wasm'));
await copyFile(compatWasmSource, join(root, 'public/wllama-compat/wllama.wasm'));
await copyFile(compatWorkerSource, join(root, 'public/wllama-compat/wllama.js'));
console.log('Prepared bundled wllama default and compatibility runtime assets.');

async function firstExisting(paths) {
  for (const path of paths) {
    try { await access(path, constants.R_OK); return path; } catch { /* try next */ }
  }
  return null;
}
