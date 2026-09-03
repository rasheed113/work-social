# Work Social Offline AI — Phase 13 Premium UX

## UX objectives

Phase 13 adds a compact, premium status/control surface around the existing AI router without adding a local inference engine. The UI makes the requested mode, selected provider, local availability, model state, vision state, and processing destination understandable before and after a request.

## Mode presentation

The user can select:

- **AUTO** — the existing router policy decides. When the local runtime is unavailable, AUTO selects Gemini explicitly and the UI says that local AI is unavailable.
- **ONLINE** — explicitly selects Gemini.
- **OFFLINE** — explicitly requires the local provider. If local execution is unavailable, the request fails locally and is never silently redirected to Gemini.

The selected mode is stored only as in-memory router preference state. It is not a credential or secret.

## Provider presentation

Provider labels are derived from router policy and the authoritative local provider status. Gemini is displayed for ONLINE and for AUTO when local execution is unavailable. Local AI is displayed only when the local provider is actually reported ready.

## Local readiness

The current repository is a Vite/TypeScript web application. `DefaultLocalInferenceRuntime` has no registered platform inference adapter in this web runtime, so the UI must remain unavailable rather than displaying a false ready state.

The UI never claims local AI execution unless the underlying runtime/model state confirms it.

## Model state

The status surface distinguishes an unavailable runtime from model states exposed by the provider. It does not invent download progress or a model-ready state. No download system was added in Phase 13.

## Vision presentation

Vision is shown as unavailable when the authoritative local runtime does not expose verified vision capability. The UI does not infer vision support from a filename, MIME type, model name, browser user agent, or arbitrary metadata.

The existing repository's AI assistant did not expose a working image-attachment composer. Phase 13 therefore does not add a fake attachment/upload path. Existing image validation/provider contracts remain unchanged.

## Processing/privacy indicators

The status surface uses precise destination language:

- `Processed online` when Gemini is selected.
- `Processed locally` only when the local provider is selected.
- `Not sent online` for an explicit offline request that cannot be executed locally.

No claim is made that browser storage is encrypted, that processing is universally private, or that transport is encrypted beyond guarantees actually provided by the existing architecture.

## Offline error behavior

Explicit OFFLINE mode does not fall back to Gemini. The user-facing failure is intentionally privacy-preserving:

> Offline AI isn’t available yet on this runtime. Your request was not sent online.

## Accessibility

Mode controls are semantic buttons with `aria-pressed` state. The status surface has a semantic region, expandable details, visible focus treatment, and status text that does not rely on animation or color alone.

## Responsive behavior

The surface is compact on desktop and narrows to the viewport on mobile. It uses bounded width and does not modify unrelated application responsive rules.

## Performance

No polling loop, animation loop, IndexedDB query loop, image duplication, model download, or inference readiness cache was introduced. Status is evaluated when the component mounts and when the user changes mode.

## Browser limitations

The current web runtime has no executable local model engine. Local model lifecycle abstractions remain available for future platform integration, but the browser UI must not represent those abstractions as active inference capability.

## Security

No API keys, bearer tokens, private paths, model binaries, or sensitive runtime diagnostics are exposed in the UI. Existing provider isolation, offline routing rules, validation, and security boundaries remain authoritative.
