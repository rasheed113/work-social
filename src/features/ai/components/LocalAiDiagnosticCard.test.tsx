import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocalAiDiagnosticCard } from './LocalAiDiagnosticCard';
const diagnostic = { stage: 'WLLAMA_COMPAT_WASM' as const, code: 'WLLAMA_COMPAT_WASM_FETCH_FAILED', message: 'The browser could not fetch wllama.wasm.', resource: 'wllama.wasm', url: 'https://example.com/assets/wllama.wasm', status: 404, statusText: 'Not Found', responseType: 'basic', errorName: undefined, timestamp: new Date().toISOString() };
const html = renderToStaticMarkup(<LocalAiDiagnosticCard diagnostic={diagnostic} />);
for (const value of ['Offline AI diagnostic', 'WLLAMA_COMPAT_WASM', 'WLLAMA_COMPAT_WASM_FETCH_FAILED', 'wllama.wasm', '404 Not Found', 'https://example.com/assets/wllama.wasm', 'Next action', 'Copy diagnostic']) assert.match(html, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(html, /Sanitized URL/); assert.match(html, /role="alert"/);
console.log('LocalAiDiagnosticCard UI test: PASS');
