# Work Social — Offline AI Phase 18

## Real browser-local text inference

Phase 18 connects the existing local AI contracts to a real llama.cpp runtime executed in the browser.

### Engine

- `@wllama/wllama` 3.6.1, MIT licensed
- llama.cpp through WebAssembly, with WebGPU acceleration automatically available where supported
- Runtime WASM asset is copied from the installed npm package into `public/wllama/wllama.wasm` by `postinstall`; the generated asset is not committed
- `setCompat(null)` disables wllama's CDN compatibility fallback
- After the model is installed, inference receives model bytes from local storage and does not require an inference server

### Model

- Qwen2.5 0.5B Instruct
- GGUF, Q4_K_M
- Official source repository: `Qwen/Qwen2.5-0.5B-Instruct-GGUF`
- Artifact: `qwen2.5-0.5b-instruct-q4_k_m.gguf`
- Source URL: `https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf`
- SHA-256: `74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db`
- License: Apache-2.0

The model binary is never stored in Git. The downloader obtains the declared artifact, `ModelManager` writes it through `WebModelStorage`, and SHA-256 verification is mandatory before `INSTALLED` is recorded.

### Storage

IndexedDB database: `work-social-ai-models`  
Object store: `models`  
Model namespace: `models/<encoded-model-id>/<encoded-version>`

### Verification boundary

`ModelManager.getVerifiedModelReference()` is the authority for executable model handoff. The runtime receives only a verified reference and the adapter reads the model bytes from that reference before calling `wllama.loadModel()`.

### Execution path

```text
Work Social AI Chat
        ↓
     AiRouter
        ↓
 LocalAiProvider
        ↓
DefaultLocalInferenceRuntime
        ↓
BrowserLocalInferenceAdapter
        ↓
@wllama/wllama / llama.cpp
        ↓
Qwen2.5 0.5B Instruct GGUF
```

Explicit OFFLINE requests never route to Gemini. There is no remote inference fallback. If the local model is absent, invalid, incompatible, or the runtime is unavailable, the request fails explicitly.

### Lifecycle

```text
NOT_INSTALLED → DOWNLOADING → VERIFYING → INSTALLED
```

The existing `ModelManager.installFromBlob()` integrity contract remains authoritative.

### Streaming / cancellation

Native wllama chat streaming is mapped directly to local `TOKEN` events. Completed text is never split to simulate streaming. The runtime AbortSignal is passed to wllama's `abortSignal` option. The existing runtime cancellation state machine remains authoritative.

### Capability policy

WebAssembly is mandatory. WebGPU is detected as an accelerator but is not required because wllama supports browser WASM CPU execution. Browser RAM/storage values are treated conservatively.

### Verification limitation

CI can validate deterministic adapter-boundary wiring and provider isolation, but the repository's Node test environment cannot execute a real browser WebGPU/WASM context with the 491 MB model. Therefore CI success must not be described as proof of real model inference. A browser-capable integration run with the real model is required for that claim.
