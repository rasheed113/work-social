import assert from 'node:assert/strict';
import { GEMINI_RATE_LIMIT_CODE, isGeminiRateLimitErrorMessage, shouldOfferOfflineContinuation } from './onlineLimit';

const limit = `HTTP 429 — server ${GEMINI_RATE_LIMIT_CODE} — upstream HTTP 429 — quota exceeded`;

assert.equal(GEMINI_RATE_LIMIT_CODE, 'GEMINI_RATE_LIMIT');
assert.equal(isGeminiRateLimitErrorMessage(limit), true);
assert.equal(shouldOfferOfflineContinuation(limit), true);
assert.equal(isGeminiRateLimitErrorMessage('HTTP 500 — server GEMINI_UPSTREAM_ERROR — upstream HTTP 500'), false);
assert.equal(isGeminiRateLimitErrorMessage('HTTP 503 — server GEMINI_UPSTREAM_UNAVAILABLE — upstream HTTP 503'), false);
assert.equal(isGeminiRateLimitErrorMessage('HTTP 401 — server AUTHENTICATION_FAILED'), false);
assert.equal(isGeminiRateLimitErrorMessage('quota exceeded'), false);
console.log('onlineLimit.test.ts: PASS');
