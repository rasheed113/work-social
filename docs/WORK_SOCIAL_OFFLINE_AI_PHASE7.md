# Work Social Offline AI — Phase 7 Smart AI Router

## Scope

Phase 7 adds deterministic provider selection between the existing Gemini online provider and the existing local provider boundary. It does not add an inference engine, Android project, model binary, UI, persistence, or any network/rate-limit workaround.

## Routing modes

`AiRoutingMode` is:

- `online` — always Gemini.
- `offline` — local only; local unavailability is a structured routing error and never falls back to Gemini.
- `auto` — local only when every local preflight requirement is genuinely satisfied; otherwise Gemini is selected explicitly by the router.

Successful routes expose:

```text
provider: gemini | local
mode: online | offline
reasonCode: structured code
reason: human-readable explanation
```

## Local preflight

`LocalAiProvider.getRoutingStatus()` is the router's local readiness boundary. It reuses the existing authorities rather than duplicating their policies:

```text
AiRouter
   |
   v
LocalAiProvider routing preflight
   |
   +--> LocalInferenceRuntime status
   +--> ModelManager model state
   +--> ModelManager.checkInstallationEligibility()
   +--> ModelManager.getVerifiedModelReference()
                 |
                 +--> checksum verification
```

A model being marked installed is not sufficient. The router requires a real executable runtime and a checksum-verified model handoff. The default Vite runtime reports `UNAVAILABLE`, so the current web application cannot honestly select local inference.

## Attachment policy

The local MVP remains text-only. Any image/file attachment makes the local provider ineligible. AUTO therefore selects Gemini; OFFLINE returns `UNSUPPORTED_ATTACHMENT` without invoking Gemini.

## Current web behavior

Because the current runtime is Vite/browser-only and has no native inference adapter:

```text
AUTO   -> Gemini
ONLINE -> Gemini
OFFLINE -> LOCAL_RUNTIME_UNAVAILABLE
```

An installed model file alone cannot change this result.

## Rate-limit and security boundary

The router does not inspect, alter, retry, or bypass Gemini HTTP 429 responses. AUTO selection happens before provider generation and is based only on local readiness. OFFLINE never invokes Gemini as a fallback.

No Gemini Edge Function, Supabase schema/RLS/rate limiter, authentication flow, model binary, secret, or environment variable is changed.

## Tests

Focused router tests cover AUTO local/unavailable/model/device/attachment decisions, ONLINE forcing Gemini, OFFLINE local-only behavior and structured failures, integrity gating, no-network fallback, and deterministic decisions.

## Phase boundary

No Android/Kotlin/Gradle/JNI/NDK/CMake/llama.cpp/WebAssembly inference implementation is added. Android native execution remains owned by the future Android application boundary described in Phase 6.
