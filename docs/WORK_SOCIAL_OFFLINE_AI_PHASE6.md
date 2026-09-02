# Work Social Offline AI — Phase 6 Android Native Execution Target

## Decision

The authoritative `rasheed113/work-social` repository remains a TypeScript/Vite web application. Forensic inspection at the Phase 5 HEAD found no existing Android application/module boundary, Gradle project, Kotlin/Java source tree, JNI/NDK boundary, CMake native build, Capacitor/React Native/Flutter/Tauri shell, or other native/mobile application scaffold.

The offline blueprint does identify Android as the intended eventual execution target and describes a future Kotlin/JNI/native runtime. That is architectural intent, not evidence that this web repository already owns an Android application source tree.

The repository root contract is explicitly a social **web application** deployed as a Vite frontend, with the root data flow GitHub → Cloudflare Pages → Work Social frontend → Supabase services. The current offline runtime documentation independently records that Android/native execution was still absent after Phase 4 and that the platform-neutral runtime was deliberately left waiting for a future Android/native adapter.

**Conclusion: Android does not yet have a legitimate executable application target in this repository. Creating `android/` now would invent a new product boundary rather than implement an already-established one. Phase 6 therefore stops at the native execution boundary and does not create an Android project, Kotlin source, JNI code, CMake files, or native model runtime.**

No other repository was inspected for implementation or modified. In particular, no Android code was copied from another repository.

## Evidence inspected

- `package.json`: Vite/TypeScript scripts only; `npm run build` is `tsc -b && vite build`, and the test script runs the existing TypeScript offline-AI boundary tests.
- `vite.config.ts`: only the React Vite plugin is configured.
- Root repository tree: no Android, Gradle, Kotlin/Java, JNI, NDK, CMake, or native/mobile application tree exists.
- `docs/WORK_SOCIAL_OFFLINE_AI_BLUEPRINT.md`: Android is described as the eventual on-device execution target, with Kotlin → JNI/native inference architecture and app-private model storage.
- `docs/WORK_SOCIAL_OFFLINE_AI_PHASE4.md`: explicitly records that the authoritative repository had no Android/native target and defines `LocalInferenceEngineAdapter` as a future Android/native adapter.
- `docs/WORK_SOCIAL_OFFLINE_AI_PHASE5.md`: explicitly keeps real offline generation unavailable because no executable Android/native target exists.
- Offline AI source contracts: the provider-neutral TypeScript boundary already exists and is intentionally isolated from native implementation details.

Searches for Android, Kotlin, Gradle, Capacitor, React Native, Flutter, Tauri, WebView, JNI, and native/mobile execution markers found no existing native application implementation. The Android search hits are architectural references in the offline-AI blueprint/source contracts and an Android FCM database integration; they are not an Android application target.

## Existing native boundary that must be preserved

The existing provider-neutral runtime remains the authority:

```text
LocalAiProvider
      |
      v
LocalInferenceRuntime
      |
      v
LocalInferenceEngineAdapter
      |
      v
Future AndroidNativeInferenceAdapter
      |
      v
Kotlin LocalInferenceBridge
      |
      v
JNI
      |
      v
Native GGUF runtime
```

The TypeScript layer must not import Android APIs. The future adapter must be the only platform-specific connection point.

## Required Kotlin interface

When an authoritative Android application target exists, its Kotlin boundary should implement the following conceptual contract without exposing native pointers or llama.cpp types to application code:

```kotlin
interface LocalInferenceBridge {
    suspend fun initialize()
    suspend fun loadModel(model: VerifiedLocalModelReference)
    suspend fun unloadModel()
    suspend fun generate(request: InferenceRequest): InferenceResponse
    fun stream(request: InferenceRequest): Flow<InferenceStreamEvent>
    suspend fun cancel()
    fun status(): LocalInferenceStatus
    suspend fun dispose()
}
```

The concrete Kotlin types are an Android-side representation of the existing provider-neutral contracts. The web TypeScript contracts remain platform-neutral.

## Model ownership boundary

`ModelManager` remains the authority for model eligibility, installation state, and checksum-verified runtime handoff:

```text
ModelManager
    |
    v
VerifiedLocalModelReference
    |
    v
AndroidModelStorage
    |
    v
Kotlin/JNI runtime
```

The future Android runtime must never accept an arbitrary filesystem path or URL supplied by the UI. It must receive only a verified model handoff derived from `ModelManager`.

## Device capability boundary

The existing `DeviceCapability` contract already reserves Android-specific facts without inventing them in the web runtime:

- total RAM
- available RAM
- CPU cores
- CPU architecture / ABI
- Android version
- available storage
- thermal state
- battery level
- charging state

The future Android provider must populate these from real Android APIs. Unknown optional values must remain unknown rather than being inferred from browser APIs.

## Model eligibility boundary

The existing eligibility policy remains authoritative. Before a native load, the future Android implementation must evaluate:

```text
Android DeviceCapability
        |
        v
evaluateLocalModel()
        |
        v
ModelManager
        |
        v
VerifiedLocalModelReference
        |
        v
Native runtime
```

The primary planning target remains Android/arm64-v8a with approximately 4 GiB RAM and 2.5 GiB free-storage planning thresholds. These are policy requirements, not proof that a production model is installed.

The future runtime must reject at minimum:

- insufficient RAM;
- insufficient storage;
- unsupported ABI;
- unsupported Android version;
- invalid checksum;
- missing model.

## Native runtime boundary

The intended future implementation may use a pinned `llama.cpp` release/commit and GGUF CPU inference, initially targeting `arm64-v8a`. No native runtime was integrated in Phase 6 because there is no established Android application/build boundary in this repository against which it can be compiled and verified.

No llama.cpp source, native library, generated ABI artifact, or model binary is added by this phase.

## Streaming and cancellation contract

The existing runtime contract already defines real streaming events and cancellation. A future Android implementation must propagate them end-to-end:

```text
LocalAiProvider
    |
    v
LocalInferenceRuntime
    |
    v
AndroidNativeInferenceAdapter
    |
    v
Kotlin
    |
    v
JNI
    |
    v
native generation
```

Completed text must never be split into fake tokens. Cancellation must stop native generation and leave the model/runtime in a reusable or safely disposed state.

## Security boundary

The future Android target must preserve these rules:

- no Gemini/API credential in the native layer;
- no arbitrary native library loading;
- no arbitrary executable path execution;
- model checksum verification before native loading;
- model files confined to app-private storage;
- no model binary committed to Git;
- no untrusted native code downloaded at runtime;
- no raw native pointers exposed to Kotlin/UI code;
- no native generation after disposal;
- no native execution before model verification.

## Lifecycle boundary

A future Android implementation must explicitly own model/runtime resources across activity recreation, backgrounding, process death, low-memory pressure, repeated load/unload, cancellation races, and concurrent-generation rejection/serialization. Large model resources must not be kept alive unnecessarily and inference must not continue invisibly in the background.

## Build status

No Android build was attempted because no Android project was created. It would be misleading to report `./gradlew test` or `./gradlew assembleDebug` as passing when no Gradle project exists.

The existing web build configuration was not changed. The repository's existing GitHub Actions build remains a Node/Vite build and was not altered.

The Phase 5 documentation already records that this execution environment cannot perform a repository checkout from `github.com`, so `npm install`, `npm test`, and `npm run build` are not claimed as locally executed in this environment.

## Scope preservation

Phase 6 does **not** change:

- Gemini provider behavior;
- Gemini rate-limit behavior;
- AI routing/fallback behavior;
- Supabase schema or functions;
- Supabase RLS;
- database behavior;
- UI behavior;
- offline conversation persistence;
- offline vision;
- local memory;
- cloud synchronization;
- performance optimization;
- model binaries.

## Final blocker

> **The authoritative repository remains web-only and forensic architecture review did not justify creating an Android target here. No other repository was touched. The Android/native execution boundary remains documented for future integration.**

The next Android implementation phase should begin only when the authoritative architecture explicitly assigns an Android application source boundary to this repository (or explicitly identifies this repository as the owner of that target). At that point the Kotlin/Gradle/JNI/native implementation can be added without guessing ownership or copying code across repositories.
