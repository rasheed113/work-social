# Work Social Offline AI — Phase 5 Text MVP Boundary Status

## Decision

The authoritative `rasheed113/work-social` repository remains a TypeScript/Vite web application. Inspection of the repository shows no Android Gradle project, Kotlin/Java source tree, JNI bridge, NDK/C++ module, CMake native build, or other legitimate executable Android/native inference target.

Therefore Phase 5 **does not activate real offline text generation** in this repository. No browser/WebAssembly inference engine, llama.cpp port, fake adapter, model binary, or external AI fallback was introduced merely to make the feature appear functional.

> **Phase 5 could not honestly activate real offline text generation because the authoritative repository remains Vite-only and has no executable Android/native inference target. No fake inference or external fallback was introduced.**

## Implemented boundary

The provider path is now explicit and provider-neutral:

```text
AiMessage[] + generation options
        |
        v
LocalAiProvider
        |
        +--> default Vite runtime -> OFFLINE_TEXT_AI_UNAVAILABLE
        |
        +--> future real adapter
                 |
                 v
          ModelManager
                 |
                 v
     VerifiedLocalModelReference
                 |
                 v
       LocalInferenceRuntime
                 |
                 v
        actual native engine
```

`LocalAiProvider` never calls Gemini, never calls an external AI API, never fabricates text, and never falls back to Gemini.

## Model state contract

The provider distinguishes the relevant local model conditions before attempting runtime execution:

- `MODEL_NOT_INSTALLED`
- `MODEL_INVALID`
- `MODEL_INCOMPATIBLE`
- `INSUFFICIENT_RESOURCES`
- `OFFLINE_TEXT_AI_UNAVAILABLE`

Phase 3 remains the authority for model eligibility and checksum-verified runtime handoff. The primary 3B–4B GGUF metadata remains planning-only; it has no trusted checksum and no model binary.

## Generation contract

The existing `AiMessage` abstraction is reused. Generation options now support:

- `maxOutputTokens` → bounded to 1–2048, default 512
- `temperature` → bounded to 0–2, default 0.7
- `topP` → bounded to >0–1, default 0.9
- `contextSize` → bounded to 256–8192, default 2048
- `stopSequences` → maximum 8
- `signal` for cancellation propagation

The provider does not implement a second chat-message architecture or persistent offline history. Context/tokenization remains a responsibility of the real inference adapter once an executable native target exists.

## Streaming and cancellation

No local streaming is exposed as working because no real local execution engine exists. The Phase 4 runtime continues to expose streaming/cancellation capabilities for a future adapter; the default web runtime does not simulate them.

## Images

Attachments are rejected by the Phase 5 text-only provider with `UNSUPPORTED_ATTACHMENT`. Images are never forwarded to Gemini by `LocalAiProvider`.

## Security

No API key or Gemini credential is needed by the local boundary. Model execution remains gated by the Phase 3 verified model reference and Phase 4 runtime boundary. No arbitrary model path/URL execution was added, and no model binary was committed.

## Persistence

No permanent local conversation database was added. Existing online persistence and Supabase conversation/message behavior remain outside this phase. Offline persistent history is intentionally deferred.

## Routing

The AI router remains unchanged. There is no automatic online/offline routing and no Gemini failure or 429 fallback to local AI in Phase 5.

## Performance

Performance benchmarking is unavailable because no executable local inference target exists. No model load time, first-token latency, tokens/sec, memory, or battery figures are claimed.

## Verification limitation

The repository is accessible through GitHub, but this execution environment cannot resolve `github.com` for a repository checkout. Consequently `npm install`, `npm test`, and `npm run build` could not be truthfully executed here. The repository's deterministic Phase 5 boundary test is included in the test script and must be executed from a network-enabled checkout before declaring the command-level test/build gate passed.
