# Work Social Offline AI — Phase 11 Security Audit

## Status

Phase 11 hardens the existing Phase 1–10 offline AI boundary without adding a new inference engine, model binary, cloud sync path, Android code, or UI behavior.

Authoritative repository: `rasheed113/work-social`
Branch: `main`

## Threat model

The security boundary assumes an untrusted browser page, malformed persisted IndexedDB records, malformed image bytes/metadata, forged attachment references, invalid model metadata, compromised or buggy future local inference adapters, and accidental credential-like data supplied to AI context/history.

The browser is **not** treated as a hardware-backed trust anchor. A user with developer tools or control of the origin can inspect and mutate browser storage and JavaScript state.

## Trust boundaries

```text
UI / application input
        |
        v
provider-neutral AI contracts
        |
        +--> AiRouter -----> Gemini (ONLINE only)
        |
        +--> LocalAiProvider (OFFLINE only)
                    |
                    v
             LocalInferenceRuntime
                    |
                    v
                ModelManager
                    |
                    v
        checksum-verified model reference
```

History, local memory, image validation, and context are local data boundaries. They do not grant provider or execution capabilities.

## Secret handling

Offline AI source contains no Gemini API key, Supabase service-role key, bearer token, private backend credential, or model-download credential. Legitimate server-side credentials remain environment-managed outside the offline provider/runtime boundary.

History and memory reject common credential-like keys/values. Runtime adapter errors are sanitized before being surfaced when they are not already structured local errors.

Security code never prints discovered secret values.

## Network isolation

`LocalAiProvider` and `DefaultLocalInferenceRuntime` contain no Gemini/Supabase/network call path. Offline routing fails closed when local capability is unavailable. The router does not reinterpret a local runtime failure as permission to call Gemini in `OFFLINE` mode.

`AUTO` may choose Gemini when local capability is unavailable; that is explicit router policy. `ONLINE` explicitly chooses Gemini. This is different from a hidden local-to-cloud fallback.

No global `fetch` monkey-patching or fake browser network blocker is used.

## Provider isolation

The local provider depends on provider-neutral contracts, the local runtime, model manager, and local vision validation. Gemini is wired separately through `GeminiAiProvider`.

A deterministic source-isolation test checks that local provider/runtime code does not import or invoke Gemini, Supabase, or `fetch`.

## Image security

Supported image MIME types remain exactly JPEG, PNG, and WebP.

Validation enforces:

- maximum image count;
- maximum image bytes;
- safe filename length/content;
- safe attachment reference length/content;
- declared-size consistency when bytes are available;
- byte-derived dimensions when bytes are available;
- positive, bounded dimensions;
- format signatures and basic structural checks;
- malformed/truncated byte rejection where the format parser can safely detect it.

Filename extensions are never treated as proof of type. Invalid image data is rejected; it is not silently converted or described.

## Attachment reference security

Opaque local attachment IDs are allowed. Browser object URLs are allowed only through the `blob:` protocol. `javascript:`, `data:`, HTTP(S) remote references, path traversal, slash/backslash traversal, control characters, and encoded traversal patterns are rejected in the local vision boundary.

This preserves legitimate browser blob/object references without treating arbitrary remote locations as local model input.

## Model integrity

The invariant is:

```text
model metadata
    |
    v
ModelManager eligibility
    |
    v
installed model + required SHA-256
    |
    v
checksum verification
    |
    v
VerifiedLocalModelReference
    |
    v
LocalInferenceRuntime
```

Missing checksums are not trusted. Checksum mismatches make models invalid and trigger cleanup during installation. Runtime handoff requires the branded verified reference and re-verifies the model bytes through the reference before loading.

A model being installed or having `VISION` metadata does not by itself make it executable. Runtime capability and model modality are checked independently. The Phase 3 primary model remains text-only.

## Storage boundary

Web model storage uses the existing origin-scoped IndexedDB model store and a namespaced key derived with `encodeURIComponent(model.id)` and `encodeURIComponent(model.version)`. Model operations receive managed model descriptors rather than arbitrary filesystem paths.

No native filesystem implementation was added. Browser storage is not treated as an Android app-private filesystem.

## IndexedDB history security

The existing `work-social-ai-history` database remains the only AI history database. Conversation messages and attachment metadata remain bounded. Attachment records contain metadata only; image `Blob` data is not part of the history contract.

Malformed persisted records are rejected on read. Credential-like message/title/summary/attachment data is rejected rather than silently persisted. Existing explicit delete and clear operations remain available.

## Local memory security

Phase 9 memory bounds remain enforced. Secret-like keys and values are rejected, malformed records are rejected on read, and memory operations remain explicitly scoped to the memory store. No credential extraction or automatic sensitive-data extraction is introduced.

## Context security

Context remains bounded by its existing character/message limits. Current requests, bounded history, explicit memories, and structured image attachments are preserved without fabricated descriptions, OCR, embeddings, or automatic image understanding.

Direct context construction also rejects credential-like memory data so an unsafe memory object cannot be promoted into model context merely by bypassing the IndexedDB store.

## Error sanitization

Local runtime errors preserve structured `LocalInferenceRuntimeError` values and sanitize unstructured adapter error messages. Common bearer tokens, authorization values, cookie values, credential-like assignments, and private filesystem path patterns are redacted.

The goal is to remove secret leakage without deleting useful structured diagnostics.

## Vision security

Vision execution requires all of the following:

- valid image input;
- a vision-capable or multimodal model as appropriate;
- installed model state;
- checksum verification;
- device/resource eligibility;
- a runtime that explicitly advertises the required vision capability.

Changing metadata on the text model cannot turn it into a working vision model. No local VLM is present in this repository.

## Browser security limitations

### CURRENT WEB SECURITY

This repository is a Vite/TypeScript web application. IndexedDB is origin-scoped browser storage, but it is **not encrypted by this implementation**. Browser JavaScript and storage are inspectable and mutable by a user or a compromised origin. Local model storage is therefore not equivalent to Android app-private storage and is not tamper-proof.

The Phase 11 hardening provides application-level validation and trust boundaries; it does not claim hardware-backed key storage, filesystem ACLs, process isolation, or tamper resistance.

### FUTURE ANDROID/NATIVE SECURITY

A future Android/native implementation must establish the native boundary separately. It should use app-private storage, controlled model-file permissions, secure temporary-file disposal, platform-appropriate credential/key handling, and a real native inference sandbox where appropriate.

Those protections are **future requirements, not current implementations**.

## Dependency security

Phase 11 does not perform unrelated dependency upgrades. The repository's package manager audit must be run in a network-enabled checkout with the existing lockfile/dependency installation available. If the audit cannot execute, this documentation does not claim that there are no dependency vulnerabilities.

## Deterministic security coverage

Phase 11 adds targeted coverage for:

- offline route fail-closed behavior;
- absence of Gemini/network dependencies in local code;
- valid JPEG/PNG/WebP bytes;
- unsupported, oversized, malformed, and pathological images;
- image-count limits;
- traversal and unsafe protocol rejection;
- supported blob URL preservation;
- model-reference trust boundary;
- runtime error credential/path sanitization;
- history credential-like content rejection;
- bounded attachment metadata without binary persistence.

Existing Phase 1–10 tests remain in the package test script and are not weakened or removed.

## Known pre-existing issue

Phase 4 contains a test/runtime error-name mismatch in `src/features/ai/runtime/localInferenceRuntime.test.ts`: the historical test expectation is `GENERATION_CANCELLED` while the current runtime contract emits `INFERENCE_CANCELLED`.

Phase 11 does not normalize this unrelated contract merely to make the test suite green. It should only be changed in a later focused contract decision if the project explicitly requires that normalization.

## Residual risks

- Browser storage remains user-controlled and is not cryptographically protected.
- A future platform inference adapter is outside this web repository and must enforce its own native process/file security.
- Image parsers intentionally perform bounded structural validation rather than full codec decoding.
- Credential detection is pattern-based and cannot prove that arbitrary text is or is not sensitive.
- Dependency vulnerability status requires an actual package-manager audit in an environment capable of resolving/installing dependencies.

## Explicit non-goals

Phase 11 does not add Android, Kotlin, Java, JNI, NDK, C++, CMake, llama.cpp, model binaries, VLM binaries, OCR, embeddings, cloud synchronization, telemetry, analytics, authentication changes, Supabase schema/RLS changes, Gemini behavior changes, navigation changes, or AI UI changes.
