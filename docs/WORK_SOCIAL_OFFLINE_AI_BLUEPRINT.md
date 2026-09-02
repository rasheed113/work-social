# Work Social — Independent Offline AI Blueprint

## Purpose

Build a true on-device AI capability for Work Social that can operate without internet access, API keys, Gemini quota, or server availability, while preserving the existing online Gemini AI path.

The offline engine is a separate provider. It must **never bypass or weaken** the existing online provider's rate limits.

## Target Architecture

```text
                         WORK SOCIAL AI
                              |
                       +------v------+
                       |   AI Router  |
                       +------+------+
                              |
                 +------------+------------+
                 |                         |
             ONLINE AI                 OFFLINE AI
                 |                         |
          Supabase Edge              Android device
                 |                  Local AI Engine
              Gemini                    |
                                  +-----+-----+
                                  |           |
                                Text        Vision
                                  |           |
                                  +-----+-----+
                                        |
                               Work Social AI UI
                                        |
                               Conversation History
```

## Core Principles

1. Keep the existing Gemini integration working throughout development.
2. Add local AI as a parallel provider, not as a replacement at first.
3. Do not silently bypass Gemini HTTP 429/rate-limit responses.
4. Offline AI must work with the device disconnected from the internet.
5. Do not bundle multi-gigabyte model files inside the base APK.
6. Use capability detection so weaker devices are not overloaded.
7. Keep sensitive local chat data in protected app-private storage.
8. Add offline vision as an optional model pack after text AI is stable.

## Provider Abstraction

The application should expose a provider-independent contract:

```kotlin
interface AiProvider {
    suspend fun sendMessage(
        messages: List<AiMessage>,
        attachments: List<AiAttachment>
    ): AiResponse
}
```

Planned implementations:

```text
AiProvider
├── GeminiAiProvider
└── LocalAiProvider
```

The UI should consume the common AI service rather than depending directly on Gemini or the local inference engine.

## AI Router

The router selects the best available provider.

```text
User sends message
       |
       v
   AI Router
       |
       +-- Internet + Gemini available --> Gemini
       |
       +-- Offline ---------------------> Local AI
       |
       +-- Network failure/timeout -----> Local AI
       |
       +-- Gemini 429 ------------------> Preserve limit; do not silently bypass
```

A user may explicitly choose Offline AI when desired, even when online service is available.

## Model Strategy

Start with a small instruct model in the approximately 3B–4B class, quantized to around 4-bit, as the practical balance for Android devices.

Indicative planning targets:

| Model class | Approx. quantized storage | Practical RAM target | Role |
|---|---:|---:|---|
| 1B–1.5B | ~0.7–1.2 GB | ~2–3 GB | Low-end fallback |
| 3B–4B | ~2–3 GB | ~4–6 GB | **Primary target** |
| 7B–8B | ~4–5 GB | ~6–10 GB | Optional high-end tier |

These are planning ranges, not guaranteed requirements; actual memory depends on model architecture, context length, runtime, and acceleration.

## APK and Model Packaging

Do not ship the main model inside the APK.

```text
Work Social APK
├── Kotlin AI integration
├── Local AI runtime
└── Model Manager

App-private storage
└── models/
    ├── text/
    └── vision/
```

The model should be installed separately with a model download/installation flow. This keeps the base application manageable and permits model updates without rebuilding the entire APK.

## Local Inference Runtime

Initial implementation target:

```text
Kotlin
  |
  v
LocalAiProvider
  |
  v
JNI / native bridge
  |
  v
llama.cpp-style native inference runtime
  |
  v
Quantized GGUF model
```

Required runtime capabilities:

- Streaming token generation
- Generation cancellation
- Context management
- Configurable output length
- Model load/unload
- CPU thread control
- Optional hardware acceleration where supported

The exact runtime and model must be validated on the actual target Android devices before being locked into production.

## Device Capability Detection

Before loading a local model, inspect:

- Available RAM / memory class
- CPU architecture and cores
- Android version
- Available storage
- Thermal state
- Battery state

Example policy:

```text
< 3 GB RAM       -> local AI unavailable or tiny model
3–4 GB RAM       -> small model
4–6 GB RAM       -> 3B/4B target
6+ GB RAM        -> larger optional model
```

The policy must be conservative and configurable because Android memory pressure varies by device.

## Offline Text AI — MVP

First production milestone:

> With the phone in airplane mode, the user can open Work Social AI, send a text message, receive a locally generated response, and reopen the conversation later without internet access.

MVP capabilities:

- Text chat
- Streaming response
- Cancellation
- Local conversation persistence
- No network requirement
- No API key requirement
- No Gemini quota consumption

## Chat History

Do not create an unrelated second chat system. Reuse the existing AI conversation/message concepts where practical, while adding provider metadata.

Suggested metadata:

```text
provider = gemini | local
mode     = online | offline
```

Offline messages should be persisted locally first. Cloud synchronization can be added later with explicit conflict-resolution rules.

## Context Management

Do not pass an unlimited conversation history to a small local model.

Use:

```text
Conversation history
       |
       +-- summary
       +-- recent messages
       +-- current request
       |
       v
   Local model
```

The context strategy should be configurable and tested against latency and memory consumption.

## Local Memory

A future local memory layer may store user-approved AI context on-device.

Default privacy rule:

> Local AI memory remains local unless the user explicitly enables synchronization.

Do not expose secrets, authentication credentials, or sensitive system configuration to model context.

## Offline Image Support

Offline image understanding requires a vision-language model (VLM), not merely the text model.

Architecture:

```text
Image
  |
  v
Image preprocessing
  |
  v
Local Vision Model
  |
  v
LocalAiProvider
  |
  v
AI response
```

Initial supported image types should align with the existing Work Social AI image flow, with JPEG, PNG, and WebP as the initial target set.

Vision should be an optional model pack because it increases:

- Storage requirements
- RAM requirements
- Inference time
- Battery usage

Do not make every user download a vision model.

## Model Manager

Responsibilities:

- Model discovery
- Download
- Pause/resume
- Integrity/checksum verification
- Installation
- Version tracking
- Deletion
- Corruption recovery
- Storage checks
- Model availability state

Example UI state:

```text
OFFLINE AI

Text AI       ✓ Ready
Vision AI     [ Download ]

Storage used: ~2–3 GB
```

## Online ↔ Offline UX

The AI UI should clearly indicate the active provider without changing the conversation experience.

Online:

```text
Work Social AI        ● Online
```

Offline:

```text
Work Social AI        ◉ Offline
```

Automatic switching should be transparent but understandable to the user.

## Error Policy

| Condition | Recommended behavior |
|---|---|
| Device offline | Use local AI if installed |
| Network timeout | Fall back to local AI |
| Temporary network failure | Fall back to local AI |
| Online provider unavailable | Fall back to local AI |
| Gemini HTTP 429 | Preserve rate limit; do not silently bypass |
| Local model missing | Offer model installation |
| Insufficient RAM | Refuse local generation safely and explain |
| Insufficient storage | Block model installation with clear message |

## Security and Privacy

Production requirements:

- Never embed Gemini/API secrets in the APK.
- Keep local chat data in protected app-private storage.
- Encrypt sensitive local conversation data where appropriate.
- Keep temporary image files private and clean them after processing when no longer needed.
- Verify downloaded model integrity before installation.
- Support explicit model deletion.
- Clearly disclose whether a response was generated locally or online.
- Keep cloud sync opt-in for local-only memory/data.

## Battery and Thermal Management

Local inference can heavily load the device.

Add a performance policy such as:

```text
Balanced
Fast
Battery Saver
```

Potential controls:

- CPU thread count
- Maximum generation length
- Context size
- Model selection
- Thermal throttling response
- Background inference restrictions

## Settings Blueprint

```text
AI ENGINE

● Automatic
○ Online — Gemini
○ Offline — On-device

OFFLINE AI

Text AI       ✓ Ready
Vision AI     [ Download ]

Storage       2.4 GB

PERFORMANCE

● Balanced
○ Fast
○ Battery Saver
```

## Roadmap

### Phase 0 — Baseline / Freeze

- Record current working Work Social AI baseline.
- Verify Gemini flow.
- Verify image sending.
- Verify current rate limiting.
- Verify production build.
- Do not change unrelated application behavior.

**Exit:** Existing online AI remains fully functional.

### Phase 1 — Provider Architecture

- Introduce provider-neutral contracts.
- Isolate Gemini provider.
- Add LocalAiProvider interface/implementation boundary.
- Add common response and attachment models.

**Exit:** UI can consume AI without knowing the provider.

### Phase 2 — Device Capability Engine

- RAM detection.
- CPU/ABI detection.
- Storage detection.
- Android version detection.
- Thermal/battery signals.
- Model eligibility policy.

**Exit:** App can safely determine whether local inference is appropriate.

### Phase 3 — Model Manager

- Separate model storage.
- Download/install lifecycle.
- Integrity verification.
- Versioning.
- Delete/reinstall.
- Storage safeguards.

**Exit:** User can install/remove the offline text model safely.

### Phase 4 — Local Inference Engine

- Native runtime integration.
- Model loading/unloading.
- Streaming generation.
- Cancellation.
- Context configuration.
- Basic performance instrumentation.

**Exit:** A local model can generate a response inside a controlled test surface.

### Phase 5 — Offline Text AI MVP

- Connect LocalAiProvider to the AI UI.
- Local conversation persistence.
- Airplane-mode testing.
- Response streaming.
- Error handling.

**Exit:** Full text conversation works without internet.

### Phase 6 — Smart AI Router

- Connectivity-aware provider selection.
- Online fallback for normal operation.
- Local fallback for network failures.
- Explicit provider selection.
- Correct 429 behavior.

**Exit:** Work Social can move between online and offline AI safely.

### Phase 7 — Offline Chat History

- Local conversation cache.
- Provider/mode metadata.
- Restart persistence.
- Offline history browsing.

**Exit:** Conversations remain usable offline.

### Phase 8 — Context and Local Memory

- Context trimming.
- Conversation summaries.
- User-approved local memory.
- Privacy controls.

**Exit:** Longer conversations remain practical without uncontrolled memory usage.

### Phase 9 — Offline Vision

- Optional VLM model pack.
- Image preprocessing.
- Local image inference.
- Integration with the existing AI image composer.

**Exit:** Supported images can be analyzed without internet.

### Phase 10 — Optional Cloud Sync

- Sync queue.
- Conflict resolution.
- Retry behavior.
- Explicit privacy settings.

**Exit:** User can optionally synchronize local AI history without making cloud sync mandatory.

### Phase 11 — Security Audit

- Secrets review.
- Local storage review.
- Model integrity review.
- Attachment lifecycle review.
- Provider routing review.
- Rate-limit/bypass review.

**Exit:** Offline AI does not create a new security or quota-bypass path.

### Phase 12 — Performance Optimization

- Runtime acceleration.
- Memory optimization.
- Context optimization.
- Battery/thermal tuning.
- Device-specific benchmarks.

**Exit:** Stable performance on the supported device matrix.

### Phase 13 — Premium UX

- Online/offline status indicator.
- Model management UI.
- Download progress.
- Performance settings.
- Clear provider labeling.
- Premium Work Social AI experience.

**Exit:** Offline AI feels like a first-class Work Social capability.

## Definition of Done

The independent offline AI initiative is complete when:

- [ ] Work Social AI works with no internet connection.
- [ ] A supported local model generates real responses on-device.
- [ ] Text conversations persist locally.
- [ ] Online Gemini remains functional.
- [ ] Automatic online/offline routing works.
- [ ] Gemini 429 responses are not bypassed silently.
- [ ] Offline vision works when the optional vision model is installed.
- [ ] Models are downloaded separately from the base APK.
- [ ] Device capability checks prevent unsafe model loading.
- [ ] Local data has appropriate privacy protections.
- [ ] Battery/thermal behavior is controlled.
- [ ] Production regression testing passes.

## Recommended First Milestone

Do **not** start by rewriting the entire AI system.

Start with:

```text
Existing Gemini AI
       |
       +---- keep working
       |
       +---- add AiProvider abstraction
                    |
                    +---- LocalAiProvider
                              |
                              +---- small quantized text model
```

The first proof-of-concept should answer one question:

> **Can Work Social generate a useful AI response in airplane mode on the target Android device, reliably and without affecting the existing online Gemini flow?**

If yes, proceed to routing, history, and vision.