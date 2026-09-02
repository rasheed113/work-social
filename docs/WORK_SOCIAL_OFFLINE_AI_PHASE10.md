# Work Social Offline AI — Phase 10: Offline Vision

## Objective

Phase 10 adds a provider-neutral, truthful vision boundary to the existing offline AI architecture. It represents image requests, validates image metadata, models vision capability explicitly, preserves image metadata through local history/context, and makes local vision readiness depend on a real vision-capable model and runtime.

**This phase does not implement image understanding. There is no local VLM, no bundled vision model, no OCR, no image embeddings, and no fabricated captioning.**

## Architecture

```text
Image Request
      |
      v
Image Validator
      |
      v
Vision Capability
      |
      v
Vision-capable Model
      |
      v
Verified Local Model
      |
      v
Vision-capable Runtime
      |
      v
Real Local VLM
```

The current `rasheed113/work-social` repository truthfully stops before the final runtime stage. The eventual Android/native execution target remains `rasheed113/work-social-app`, which is intentionally untouched by this phase.

## Provider-neutral contracts

AI requests now distinguish `TEXT`, `VISION`, and `MULTIMODAL` modality. `AiVisionRequest` can carry:

- a text prompt;
- one or more image attachments;
- optional provider-neutral conversation context;
- bounded generation options.

The existing `AiAttachment` contract is reused rather than replaced. `AiMessage` can preserve structured attachments without turning them into text.

## Supported images and validation

Supported MIME types are exactly:

- `image/jpeg`
- `image/png`
- `image/webp`

The local vision boundary enforces explicit limits:

| Resource | Limit |
|---|---:|
| Images per request | 8 |
| Image bytes | 25 MiB per image |
| Filename | 255 characters |
| Attachment reference | 2,048 characters |

Structured validation errors include:

- `UNSUPPORTED_IMAGE_TYPE`
- `IMAGE_TOO_LARGE`
- `IMAGE_COUNT_EXCEEDED`
- `INVALID_IMAGE_METADATA`
- `VISION_NOT_SUPPORTED`
- `VISION_RUNTIME_UNAVAILABLE`

Declared byte size is validated when supplied. If actual `Blob` bytes are available, the validator safely checks JPEG/PNG/WebP dimensions. If only metadata/reference exists, dimensions remain `{ width: null, height: null, verifiedFromBytes: false }`; no dimensions are invented.

The validator does not trust filename extensions as proof of image type. It also rejects invalid references and unsafe filenames and never silently truncates or converts an invalid image.

## Model modality

`AiModel.type` now supports:

- `TEXT`
- `VISION`
- `MULTIMODAL`

The Phase 3 primary local model remains `TEXT`. It is not marked vision-capable and is never treated as a VLM.

No future vision model binary, checksum, installed state, or executable descriptor is added in Phase 10. A future descriptor can declare `VISION` or `MULTIMODAL`, but it must remain non-installed until a real compatible model is available and verified.

## Local readiness

Local vision is ready only when all required conditions are true:

```text
valid images
  -> vision-capable model
  -> model installed
  -> checksum verified
  -> device eligible
  -> vision-capable runtime
  -> ready
```

The runtime contract exposes capability flags for text generation, vision input, multimodal input, streaming, and cancellation. The browser runtime reports no executable local capability. A platform adapter must explicitly declare vision/multimodal support; the implementation does not infer it from a text runtime.

## Router behavior

### AUTO + text

Existing Phase 7 behavior is preserved.

### AUTO + image

The image is validated first. If local vision is unavailable, AUTO selects Gemini and the routing reason explicitly states that local vision is unavailable. This is the existing online AUTO policy, not a hidden local-to-cloud fallback inside `LocalAiProvider`.

### ONLINE + image

ONLINE explicitly selects the existing Gemini provider. Gemini implementation, Supabase rate limiting, and the `workSocialAi` function are unchanged by this phase.

### OFFLINE + image

If local vision is unavailable, routing returns a structured `AiRoutingError` such as `VISION_RUNTIME_UNAVAILABLE` or `VISION_NOT_SUPPORTED`. Gemini is never invoked.

### OFFLINE + text

Existing local text behavior is preserved. The existing browser runtime remains unavailable for actual local execution.

## Local provider safety

`LocalAiProvider` validates images and checks local vision readiness. It never:

- sends images to Gemini;
- calls a network API;
- derives image contents from filenames or MIME types;
- fabricates captions or answers;
- silently removes images and answers as if they were understood;
- turns the existing text model into a vision model.

Validation failures and local vision unavailability remain structured local errors.

## Context and history

Phase 9 context remains bounded by its existing character/message limits. Image attachments are preserved as structured inputs on `AiMessage` instead of being converted into invented descriptions.

Phase 8 history attachment metadata remains the persistence format:

- attachment ID;
- MIME type;
- optional name;
- declared size;
- reference.

No image binary is added to conversation records, no cloud synchronization is introduced, and no local image is uploaded by the vision boundary.

## Security

Phase 10 introduces no API keys or Gemini credentials in local vision code. Explicit OFFLINE mode has no network fallback. Image MIME/type, reference, filename, count, and size are bounded. The browser boundary treats references as metadata and does not expose or invent native storage paths. Future Android/native implementations remain responsible for app-private temporary/binary storage and disposal.

No automatic sensitive-image extraction is performed.

## Current web limitation

This Vite/TypeScript repository has no Android Gradle project, Kotlin, JNI, NDK, C/C++, native inference engine, executable local VLM, or bundled GGUF vision model. Therefore local image understanding is **not executable here**.

That limitation is intentional and explicit. Phase 10 provides the architecture and validation boundary needed for a future real implementation; it does not simulate the final capability.

## Verification boundary

Deterministic tests cover supported MIME types, image size/count/metadata errors, byte-derived dimensions, unknown dimensions without bytes, model modality, runtime capability truthfulness, local-provider no-fabrication/no-network behavior, AUTO/ONLINE/OFFLINE image routing, and context/history preservation of structured image metadata.

No network access, model download, cloud image analysis, or model binary is required by these tests.

## Explicit non-goals

Phase 10 does not add Android, Kotlin, JNI, NDK, C++, CMake native modules, llama.cpp, a VLM binary, OCR, image embeddings, cloud image analysis, cloud sync, AI-generated summaries, semantic image retrieval, or AI UI changes.
