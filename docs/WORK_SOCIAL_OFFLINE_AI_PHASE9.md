# Work Social Offline AI — Phase 9 Context + Local Memory

## Scope

Phase 9 adds a provider-neutral bounded context layer and an explicit local-memory persistence boundary on top of Phase 8 browser-local AI history.

```text
AiHistoryStore
      |
      v
Conversation Context Manager
      |
      +-- summary
      +-- relevant local memories
      +-- recent messages
      +-- current request
      |
      v
   AiMessage[]
      |
      v
   AiRouter
      |
      +--> Gemini
      +--> Local
```

The context layer prepares messages only. It does not select a provider, call Gemini, call Supabase, access the network, invoke `LocalAiProvider`, invoke `LocalInferenceRuntime`, or perform model execution.

## Context contract

`src/features/ai/context/` defines:

- `AiContextOptions` — maximum characters, maximum messages, summary inclusion, and optional explicit memory IDs.
- `AiContextRequest` — the non-persisted current user request.
- `AiContextResult` — provider-neutral `AiMessage[]`, included summary/memories, count, truncation flag, and character estimate.
- `AiContextError` — structured invalid-input, context-too-large, and missing-conversation errors.

The existing provider `AiMessage` role union is extended with `system` so summaries and memory can be represented without inventing tool/assistant semantics. Existing provider implementations remain adapters and are not rewritten.

## Bounded context strategy

Context construction is deterministic:

1. Validate and preserve the current request.
2. Walk persisted messages from newest to oldest.
3. Include the newest messages that fit the character and message budgets.
4. Include the stored conversation summary only when it fits.
5. Include only deterministically relevant local memories that fit.
6. Return messages in context order: summary, memories, recent messages, current request.

The current request is never silently dropped. If it is larger than the independent current-request limit, `CONTEXT_TOO_LARGE` is returned. If it is within that limit but itself exceeds the configured context budget, the request is still preserved and no older context is added.

Messages that do not fit are not partially sliced. Older fitting messages may still be considered after a larger message is skipped. No silent content truncation occurs.

## Character budgeting

The browser context layer deliberately does not pretend to know a future model tokenizer. It uses character counts only.

| Limit | Value |
|---|---:|
| Default context characters | 2,048 |
| Maximum context characters | 8,192 |
| Default context messages | 16 |
| Maximum context messages | 64 |
| Maximum current request | 2,048 characters |
| Maximum stored summary | 1,024 characters |

`estimatedCharacters` is the sum of the returned message content lengths. It is a character estimate, not a token count. There is no `4 chars = 1 token` conversion, fake tokenizer, or model-specific token estimate.

## Conversation summaries

Phase 8 already had `AiConversationSummary` as the compact conversation-list record. Phase 9 extends the existing conversation/history contract with an optional bounded `summary` field instead of introducing a duplicate summary type.

Summary text is explicitly caller-supplied and stored locally. Phase 9 does not call Gemini or local inference to generate summaries. A summary may therefore be absent. No semantic facts about the user are fabricated.

## Local memory model

`AiMemory` is provider-neutral:

```text
id
key
value
createdAt
updatedAt
```

`AiMemoryStore` exposes list, get, upsert, delete, and clear operations.

Memory is explicit and local. Phase 9 does not automatically extract memories from conversation text and does not infer sensitive personal information.

## Memory limits

| Resource | Limit |
|---|---:|
| Memories | 50 |
| Memory ID | 200 characters |
| Memory key | 128 characters |
| Memory value | 512 characters |

The production store does not silently truncate. Invalid or oversized values return structured `AiMemoryError` codes.

Obvious secret-like keys such as password, API key, access token, refresh token, session token, cookie, private key, and secret are rejected. This is a conservative storage boundary, not a claim of complete secret detection.

## Memory persistence

`IndexedDbAiMemoryStore` uses the existing Phase 8 database:

`work-social-ai-history`

The database is upgraded from version 1 to version 2 and gains a `memories` object store beside the existing `conversations` store. Existing conversation records are preserved. No second database is created.

Memory records are validated on reads. Malformed records return `AiMemoryError('INVALID_RECORD', ...)` rather than crashing consumers. Upsert preserves an existing memory's original `createdAt` while allowing its key/value/update timestamp to change.

## Deterministic relevance

Memory relevance is intentionally conservative. Two mechanisms are supported:

1. Explicit caller-selected memory IDs.
2. Exact key matching against the current request using a deterministic case-insensitive key boundary check.

This is not semantic retrieval. Memory values are not searched as if keyword matching were understanding. If a reliable relationship cannot be established, the memory is excluded.

## Privacy behavior

Phase 9 adds no network synchronization. Neither the context builder nor the memory store calls Gemini, Supabase, or any network API. Full memory values are not logged by the implementation.

Delete and clear explicitly remove local IndexedDB memory records. Browser IndexedDB is local persistence, **not cryptographically secure storage**. Phase 9 does not claim encryption at rest.

Memory is never automatically used as a reason to change AI routing or bypass Gemini rate limits.

## History integration

`buildConversationContext()` loads a conversation through the provider-neutral history boundary, optionally loads local memories, builds the bounded context, and returns the current request only in the context result. It does not persist that request and does not append duplicate messages.

The final context is ordinary provider-neutral `AiMessage[]`. The router remains responsible for choosing Gemini or Local.

## Offline behavior

Context construction and local memory persistence work without Gemini, Supabase, network access, Android, JNI, llama.cpp, or an executable local model. The current web runtime remains unable to perform real local inference; Phase 9 does not change that limitation.

## Provider independence

The context manager has no provider-specific implementation dependency beyond the shared `AiMessage` type. It does not inspect routing state, invoke a provider, or modify Phase 7 routing policy. Gemini behavior, rate limiting, Supabase schema/RLS, authentication, and `ai_messages` remain outside this phase.

## Future Android compatibility

The contracts contain no Android or browser storage assumptions. Android can later implement the same conceptual memory/context boundaries using protected app-private storage and a real model tokenizer without changing provider selection architecture.

The eventual execution engine remains responsible for model-specific tokenization. Phase 9 intentionally keeps character budgeting at the browser/provider-neutral layer.

## Tests

Phase 9 adds deterministic context and IndexedDB memory tests covering empty and single-message conversations, ordering, newest-message prioritization, budget overflow, current-request preservation, structured request overflow errors, summary inclusion/omission, character estimates, message limits, deterministic repeatability, explicit and exact-key memory relevance, memory precedence rules, CRUD lifecycle, persistence across store recreation, malformed records, empty/oversized keys and values, memory count limits, secret-like key rejection, and no-network behavior.

The existing Phase 8 history tests are updated for the version-2 IndexedDB schema and summary field so existing persistence behavior remains covered.

## Explicit phase boundary

> **Phase 9 provides bounded context construction and local memory persistence. It does not provide AI-generated summarization, semantic memory retrieval, encrypted storage, cloud synchronization, Android-native storage, or model-specific tokenization.**

The following remain deferred: offline vision, cloud sync, Android/JNI/native execution, llama.cpp integration, semantic/vector memory search, security audit, performance optimization, and premium AI UX.
