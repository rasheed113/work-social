# Work Social Offline AI — Phase 12 Performance Optimization

## Scope

Phase 12 optimizes the existing offline-AI web architecture only. It does not add a native execution engine, a model binary, cloud synchronization, telemetry, or UI behavior.

## Starting state

- Repository: `rasheed113/work-social`
- Branch: `main`
- Starting commit: `f19ad0a784fcad61583688fd8255625048201874`

## Performance audit

| Area | Finding | Severity | Phase 12 action |
| --- | --- | --- | --- |
| Context builder | Rebuilt memory messages, used repeated linear ID lookup, compiled a regex for every exact-key check, and recomputed the returned character total. | HIGH | Reuse constructed memory messages, build one ID map for explicit selections, use allocation-light exact-key boundary matching, and return the already tracked character total. |
| IndexedDB history | Database connection was already cached; append is a safe read-modify-write because the existing schema stores a complete conversation record. | MEDIUM / NO ISSUE | Preserve the transaction and schema. No race-prone atomic shortcut or speculative index was introduced. |
| Local memory | Database connection was already cached; relevance remains a deterministic exact-key scan. | MEDIUM / NO ISSUE | Preserve full validation and deterministic ordering. No embeddings/vector index or secret-filter bypass was introduced. |
| Model verification | Concurrent callers could repeat the complete eligibility/checksum path. | HIGH | Share only in-flight verification promises per model; entries are removed when the operation settles, so there is no persistent trust cache. |
| Model storage | Every operation opened and normally closed a separate IndexedDB connection. | HIGH | Reuse one origin-scoped connection per storage instance and invalidate it on version/close events. |
| Image validation | PNG/WebP validation copied the complete Blob into memory even though dimensions are available in bounded headers. | HIGH | Read only the required PNG/WebP header; JPEG remains a bounded-by-existing-size full scan because its dimensions can occur later in the file. |
| Router | Readiness checks correctly remain authoritative but can repeat validation, device checks, and verification. | MEDIUM | Do not add stale global readiness state. Safe optimization is delegated to in-flight model verification; validation remains explicit. |
| Runtime lifecycle | Concurrent initialization/loading could duplicate adapter lifecycle work or reject a second equivalent request; parent abort listeners could remain attached after successful generation. | HIGH | Deduplicate concurrent initialization and same-model loading, reject a different concurrent model load, and remove parent abort listeners on completion. |
| Memory/resource pressure | Existing hard limits are conservative and security-relevant. | MEDIUM | Keep all limits; reduce temporary allocations instead of increasing capacity. |

## Baseline and measurement approach

The repository does not contain a dedicated benchmark framework. Phase 12 therefore uses deterministic structural regression tests rather than machine-dependent timing thresholds.

The baseline was established by code inspection of the Phase 1–11 implementation. Notable baseline characteristics were:

- context construction allocated a second set of memory messages and recomputed the character total;
- explicit memory selection could scan the complete memory list once per requested ID;
- model storage opened IndexedDB for each operation;
- concurrent model handoffs could repeat verification work;
- PNG/WebP image validation read the complete Blob into an ArrayBuffer;
- runtime initialization/loading had no in-flight operation sharing;
- generation created a parent-signal listener that was not explicitly removed on normal completion.

No benchmark number is claimed because no stable benchmark harness was available and the execution environment used for repository operations did not provide outbound GitHub/DNS access for a local checkout.

## Context performance

The context order remains:

`summary -> relevant memories -> newest history -> current request`

The current request remains highest priority. The request, message, summary, memory, and context limits are unchanged. No token estimator or semantic retrieval was added.

The builder now:

- constructs each included memory message once;
- uses a temporary ID map when explicit memory IDs are supplied;
- avoids a per-memory regular-expression construction for exact-key matching;
- tracks the final character total incrementally instead of reducing the final message array again;
- keeps deterministic ID ordering and all existing secret checks.

## History performance

`work-social-ai-history` remains the existing database. The existing history implementation already retained an IndexedDB connection, and append uses a transaction-scoped read-modify-write to preserve correctness under concurrent writers. Phase 12 does not replace that with an unsafe blind update, does not add a second database, and does not introduce speculative indexes.

Full conversation validation remains intentionally present because it is part of the storage/security boundary and the existing schema stores messages inside the conversation record.

## Local memory performance

The memory store already reused its IndexedDB connection and has bounded storage (`maxMemories = 50`). Exact-key retrieval remains deterministic and does not use embeddings or vector search. Secret-like key/value filtering remains mandatory.

No optimization was accepted that would skip validation of stored memory records or weaken secret detection.

## Model verification performance

Checksum verification remains authoritative:

`model bytes -> SHA-256 -> trusted model reference`

Phase 12 only deduplicates **in-flight** verification for the same model. The promise is deleted after it settles. There is no permanent verification cache, and no model is trusted solely because metadata says it was previously verified.

`WebModelStorage` now reuses its IndexedDB connection instead of reopening the database for every read/write/checksum operation. Version changes and unexpected closes invalidate the cached connection so future operations reopen it.

## Image validation performance

JPEG/PNG/WebP support, size limits, count limits, reference checks, metadata checks, malformed-input rejection, and dimension safety remain unchanged.

PNG and WebP dimension parsing only needs a small fixed header, so Phase 12 uses `Blob.slice()` for those formats instead of materializing the complete image. JPEG dimension markers may occur later, so its existing full-buffer scan is retained and remains bounded by the already-enforced image size limit.

No OCR, embeddings, compression, decoding pipeline, or image processing was added.

## Router performance

The router still implements exactly:

- `AUTO`: local when verified and ready, otherwise Gemini;
- `ONLINE`: Gemini;
- `OFFLINE`: local when ready, otherwise a structured unavailable error.

No long-lived readiness cache was introduced because device state, storage state, model state, and attachment validity can change. The model manager's in-flight verification sharing reduces duplicate concurrent verification without creating stale readiness state.

## Runtime lifecycle performance

The runtime still exposes the existing states:

`UNAVAILABLE, UNINITIALIZED, INITIALIZING, READY, LOADING_MODEL, MODEL_READY, GENERATING, CANCELLING, ERROR, DISPOSED`

Phase 12 makes initialization idempotent after reaching `READY`/`MODEL_READY` and shares concurrent initialization. Loading the same verified model while it is already loaded is a no-op, and concurrent requests for the same model share the in-flight load. A different model cannot silently join that load.

The loaded verified model remains reusable after cancellation. Disposal remains explicit and the disposed state cannot be restarted through the normal lifecycle methods.

## Cancellation

Generation still uses `AbortController`. The caller signal is bridged to the runtime controller, and the parent abort listener is explicitly removed when generation/streaming finishes normally or exceptionally. This reduces retained listener/closure lifetime without changing cancellation semantics.

No timer-based or simulated cancellation was introduced.

## Resource limits

Phase 12 keeps the existing hard limits for:

- current request size;
- context characters and messages;
- summary size;
- history messages and conversation count;
- memory count, key size, and value size;
- attachment count and metadata sizes;
- image byte size and dimensions;
- local generation parameters.

Large inputs are rejected early rather than increasing limits for performance reasons.

## Browser limitations

This is still a web runtime. IndexedDB and browser Blob APIs are used only behind their existing capability boundaries. There is no claim of native/mobile inference performance.

The current repository does not contain an executable local model engine. Runtime adapters remain an abstraction boundary for a future platform implementation.

## Known bottlenecks

- JPEG dimension validation can require scanning the full image Blob because JPEG SOF markers are not guaranteed to be in a fixed-size header.
- History conversations store the complete message array in one IndexedDB record, so safe append requires read-modify-write under the current schema.
- Router readiness remains deliberately validation-heavy because a stale readiness cache could violate security/correctness requirements.
- Actual model inference performance cannot be measured here because no model binary or web inference engine is present.

## Security

Security remains higher priority than performance. Phase 11 controls were preserved: checksum verification, image validation, attachment reference validation, secret detection, sanitized errors, provider isolation, offline network isolation, and capability checks.

## Future native work

**Current web runtime:** architecture/performance optimized.

**Actual local model inference:** not executable in the current web repository.

**Future native execution:** `work-social-app` only. Phase 12 does not implement or modify that repository.
