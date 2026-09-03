# Work Social Offline AI — Phase 14 Release Audit

## Scope

Phase 14 is a critical CI contract repair and release-readiness audit for Offline AI Phases 1–13. The authoritative repository is `rasheed113/work-social`, branch `main`. Phase 13 remains the single parent commit; no history rewrite, reset, revert, squash, or cross-repository change is performed.

## Starting state

- Starting HEAD: `61aa85ae0601a7757aac40e13f97d97987a76438`
- Phase 13 message: `feat(ai): add premium offline ai ux`
- Phase 13 parent: `b9f2c3a195c9c99d1fdeef3dc40cf453f5ebe0bc`
- Phase 13 diff was inspected. It added the premium status surface, premium UX state tests, and the persisted in-memory routing-mode preference; it also tightened router status access. It did not add an inference engine, model downloader, model binary, or Gemini fallback.

## CI failure and root cause

The red test was `src/features/ai/runtime/localInferenceRuntime.test.ts`. The implementation's default browser runtime is intentionally constructed without an adapter and therefore has status `UNAVAILABLE`. `initialize()` calls `requireAvailable()`, which raises the current runtime error code `OFFLINE_TEXT_AI_UNAVAILABLE`.

The test was stale: it expected the historical Phase 4 identifier `LOCAL_RUNTIME_UNAVAILABLE`. That identifier remains a provider-routing reason code used by `AiRouter`/`AiProviderStatus`; it is not the authoritative `LocalInferenceRuntimeError` code. The runtime contract explicitly contains `OFFLINE_TEXT_AI_UNAVAILABLE` and does not contain `LOCAL_RUNTIME_UNAVAILABLE`.

The same test contained a second stale historical identifier: cancellation expected `GENERATION_CANCELLED`, while the current runtime contract and implementation emit `INFERENCE_CANCELLED`.

Phase 13 did not change `localInferenceRuntime.ts`; the mismatches predated Phase 13. Phase 11 documentation already identified the cancellation mismatch as a known stale test contract. Phase 14 corrects the test to the current authoritative runtime contract rather than weakening runtime behavior.

## Exact fix

Only `src/features/ai/runtime/localInferenceRuntime.test.ts` was changed for behavior: two assertions now use the authoritative runtime error codes:

- `LOCAL_RUNTIME_UNAVAILABLE` → `OFFLINE_TEXT_AI_UNAVAILABLE`
- `GENERATION_CANCELLED` → `INFERENCE_CANCELLED`

No runtime behavior, provider routing, Gemini path, authentication, Supabase, Edge Function, database schema, model storage, or unrelated UI behavior was changed.

## Authoritative error contract

`LocalInferenceErrorCode` currently includes:

`OFFLINE_TEXT_AI_UNAVAILABLE`, `MODEL_NOT_INSTALLED`, `MODEL_INVALID`, `MODEL_INCOMPATIBLE`, `RUNTIME_UNAVAILABLE`, `MODEL_LOAD_FAILED`, `INFERENCE_FAILED`, `INFERENCE_CANCELLED`, `CONTEXT_TOO_LARGE`, `INSUFFICIENT_RESOURCES`, `UNSUPPORTED_ATTACHMENT`, `INVALID_STATE`, `INVALID_MODEL_REFERENCE`, `MODEL_NOT_READY`, `VISION_NOT_SUPPORTED`, `VISION_RUNTIME_UNAVAILABLE`, `UNSUPPORTED_IMAGE_TYPE`, `IMAGE_TOO_LARGE`, `IMAGE_COUNT_EXCEEDED`, and `INVALID_IMAGE_METADATA`.

`LOCAL_RUNTIME_UNAVAILABLE` is retained only as a provider/router readiness reason code and compatibility alias where already defined; it is not restored as the runtime error code. `GENERATION_CANCELLED` is not restored; `INFERENCE_CANCELLED` is authoritative.

## Provider routing

`AiRouter → GeminiAiProvider / LocalAiProvider` remains intact. `ONLINE` explicitly selects Gemini. `OFFLINE` explicitly requires a ready local provider and throws a structured local routing error when unavailable; it never falls through to Gemini. `AUTO` selects local only when the local provider reports verified readiness, otherwise explicitly selects Gemini.

## Runtime boundary

`LocalAiProvider → LocalInferenceRuntime → LocalInferenceEngineAdapter` remains the execution boundary. The browser default runtime has no registered adapter and therefore truthfully reports `UNAVAILABLE`. A verified model reference is still required before model loading.

## Model manager

The audit confirmed eligibility checks for platform, architecture, RAM, storage, and Android version; SHA-256 verification before runtime handoff; invalid-model handling; safe deletion state transitions; concurrent verification deduplication; and branded verified-model handoff. No persistent verification result is cached after the in-flight operation settles.

## History and memory

IndexedDB remains the browser-local persistence boundary. History is bounded, validates stored records, preserves provider/mode metadata, stores attachment metadata/reference rather than image binaries, and rejects credential-like content. Local memory remains bounded with CRUD/clear behavior and secret-like key/value rejection.

## Context

Context remains bounded by deterministic character and message limits. The current request is preserved as the final message, recent history is selected from newest backward, summaries are bounded, and relevant memories are selected deterministically with explicit memory IDs supported. Character accounting is literal character counting; no fabricated tokenization is used.

## Vision

JPEG, PNG, and WebP validation remains byte/header based with image count, byte-size, filename/reference, and dimension checks. Local vision requires an authoritative runtime capability and a vision-capable model. Unsupported local vision fails closed; there is no fabricated image understanding.

## Security

The offline AI source contains no API key, bearer token, service-role credential, or private model credential. Error diagnostics are sanitized for common credential/path disclosure. Attachment references are constrained to safe opaque or browser `blob:` references. Secret-like memory data is rejected. Offline routing contains no Gemini/Supabase/network fallback path.

## Performance

Phase 12/13 boundaries remain: no local readiness polling loop, no long-lived readiness cache, verification is deduplicated while in flight, generation cancellation listeners are cleaned up, and image parsing is bounded to required bytes for PNG/WebP while JPEG parsing is performed against the supplied image bytes.

## Premium UX / false readiness audit

The Phase 13 status surface derives provider and processing labels from router/provider state. The default browser runtime is unavailable, so it does not display local readiness. `Processed locally` is only selected for an actual offline route; explicit unavailable offline mode is represented as `Not sent online`. No browser UI claims universal encryption or privacy guarantees beyond the actual architecture.

Searches for fake/mock/demo/placeholder/stub/simulated/hardcoded local readiness were reviewed. Test-only fixtures such as `FakeAdapter` and `fake-indexeddb` are deterministic test infrastructure, not production inference. No fake local inference engine or hardcoded local-ready runtime was found.

## Android boundary

No Android project, Kotlin, Java, JNI, NDK, C++, CMake, or native GGUF runtime is introduced in this repository. Android/native execution remains future work in `rasheed113/work-social-app`; that repository is not touched by Phase 14.

## Model/network boundary

No GGUF/model binary is committed. No model download system was introduced. No hidden remote model endpoint, local-to-cloud fallback, telemetry, or cloud-sync path was introduced by the offline AI implementation.

## Gemini preservation

Phase 13's diff did not modify the Gemini provider implementation or Supabase Edge Function. Phase 14 changes only the stale runtime test contract plus this audit document. Existing authentication, Supabase calls, rate limiting, online image behavior, and online AI request flow are preserved.

## Dependency / command verification

The repository's existing CI workflow runs Node 22, `npm install`, `npm test`, and `npm run build` on pushes to `main`. The present tool environment cannot resolve `github.com`, so a local checkout and direct `npm install`, `npm test`, `npx tsc --noEmit`, `npm run build`, and `npm audit` cannot be truthfully claimed as executed here. Phase 14 therefore does not record fabricated command results. Remote CI is the authoritative post-commit execution gate for the test/build commands. No dependency upgrade is performed merely to improve audit output.

## Release conclusion

The critical failure is a stale test expectation, not a regression in browser local-inference availability. The browser remains correctly unavailable until a real platform inference adapter exists. Offline semantics remain fail-closed; AUTO/ONLINE/OFFLINE routing remains explicit; no fake inference or false readiness is introduced.

Command-level test/build/audit results must be reported from actual execution and must not be inferred from static inspection.
