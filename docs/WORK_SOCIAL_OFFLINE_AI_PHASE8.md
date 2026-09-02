# Work Social Offline AI — Phase 8 Offline Chat History

## Scope

Phase 8 adds a provider-neutral local conversation history boundary to the existing Work Social AI architecture. It stores successful conversation turns locally in the browser and records the provider/mode that actually produced each message when that metadata is available.

The history layer does not know about Gemini, Supabase, Android, JNI, llama.cpp, model binaries, rate limits, or network state. It stores history data only.

## Architecture

```text
AI UI / caller
      |
      +--------------------> AiHistoryStore
      |                         |
      |                         v
      |                  IndexedDbAiHistoryStore
      |
      +--------------------> AiRouter
                                |
                         +------+------+
                         |             |
                      Gemini          Local
                     online           offline
```

`AiHistoryStore` is the persistence contract. `IndexedDbAiHistoryStore` is the browser implementation. A future Android implementation can satisfy the same contract without importing browser storage APIs. A future cloud-sync adapter can be introduced separately without making local history depend on Supabase.

## Data model

`AiConversation` contains:

- stable conversation ID
- optional title
- ISO creation/update timestamps
- ordered `AiHistoryMessage[]`

`AiHistoryMessage` contains a stable message ID, `user`/`assistant`/`system` role, content, creation timestamp, optional `provider` (`gemini` or `local`), optional `mode` (`online` or `offline`), and optional attachment metadata.

Attachments deliberately contain metadata/reference fields only: ID, MIME type, name, size, and reference. Binary image/file contents are never written into the conversation record.

Message IDs are generated with `crypto.randomUUID()` where available, with a cryptographically-random-values fallback. Array indexes are never used as IDs.

## Persistence boundary

The browser implementation uses a dedicated IndexedDB database:

`work-social-ai-history`

Database version 1 contains a structured `conversations` object store keyed by conversation ID. Reads validate persisted records before returning them. Missing conversations return `null`; malformed records produce `AiHistoryError` with a structured code.

Create, append, update, delete, and clear operations use IndexedDB transactions. Appending performs a read-modify-write inside a `readwrite` transaction, rejects duplicate message IDs, and enforces the message limit before writing. IndexedDB transaction serialization prevents a normal concurrent append from silently overwriting an earlier append.

## Limits

The limits are explicit in `AI_HISTORY_LIMITS`:

| Resource | Limit |
|---|---:|
| Conversations | 100 |
| Messages / conversation | 200 |
| Message content | 12,000 characters |
| Conversation title | 200 characters |
| Attachments / message | 8 |
| Attachment name | 255 characters |
| Attachment MIME type | 127 characters |
| Attachment reference | 2,048 characters |
| Attachment metadata size | 25 MiB maximum declared size |

The store does not silently truncate content. Limit violations return structured errors.

## Provider and mode metadata

Provider and mode are persisted independently of message text:

```text
Gemini -> provider: gemini, mode: online
Local  -> provider: local,  mode: offline
```

The history layer does not infer either value from network state or message content. Callers should persist the actual route/provider result. Metadata is optional so older or provider-neutral history remains valid.

## Offline behavior

IndexedDB access requires no network request. The history store can create, read, update, and delete conversations when Gemini, Supabase, and the local inference runtime are unavailable.

Phase 8 does not make the current Vite runtime capable of local inference. Phase 7 still owns provider routing and the current web runtime still reports local inference as unavailable. When a real local provider becomes executable later, successful local turns can use this same history contract without changing the persistence implementation.

## Inference failures

The history store never fabricates assistant responses. Phase 8's persistence boundary exposes only explicit conversation/message operations; the inference caller is responsible for deciding whether a failed turn should be recorded. A successful assistant message must carry its real provider/mode metadata rather than an inferred value.

## Privacy

The history database is application-specific and is never uploaded by this store. There are no Gemini calls, Supabase calls, API keys, secrets, or network synchronization paths in the history implementation. Delete and clear operations physically remove local IndexedDB records.

Browser-local persistence is **not cryptographically secure storage**. This phase does not claim encryption at rest, and browser data may be accessible to code running in the same origin/browser profile. Sensitive-data encryption is outside this phase.

## Future Android compatibility

The TypeScript `AiHistoryStore` contract intentionally contains no IndexedDB, DOM, browser, Android, JNI, or native-runtime concepts. The future `rasheed113/work-social-app` project can implement the same conceptual boundary with protected app-private storage without importing web persistence code.

No Android/native code is added in Phase 8.

## Future cloud-sync boundary

Phase 8 is local-only. It does not add Supabase history, cloud synchronization, conflict resolution, multi-device sync, server-side AI history, or account-level AI history. A later sync phase should consume local history through an explicit synchronization boundary and define conflict rules before uploading anything.

## Existing system preservation

The existing Gemini provider, Gemini Edge Function, `ai_messages`, Supabase schema/RLS, rate limiter, authentication, navigation, social features, realtime chat, Work House, model binaries, secrets, and environment variables are outside this change.

The Phase 7 router remains responsible for provider selection. The history layer never calls a provider and never changes routing policy.

## Tests

The focused history test suite uses `fake-indexeddb` only as a Node test-environment IndexedDB implementation; production code uses the real browser IndexedDB API. The suite covers lifecycle operations, ordering/timestamps/IDs, provider and mode metadata, persistence across store recreation, malformed records, failed writes, all explicit limits, local-only/no-network behavior, provider independence, concurrent appends, duplicate IDs, and attachment metadata.

## Known limitations

- Browser IndexedDB is local persistence, not encrypted storage.
- This phase does not provide cross-device synchronization.
- History is not yet a context/memory intelligence layer and does not summarize or trim model context.
- The current web runtime cannot execute local inference; Phase 8 does not change that.
- The current AI API continues to use its existing Supabase-backed conversation/message functions; Phase 8 does not modify `ai_messages` or introduce cloud history synchronization.

> **Phase 8 provides local browser persistence. It does not provide encrypted storage, Android-native storage, or cloud synchronization.**
