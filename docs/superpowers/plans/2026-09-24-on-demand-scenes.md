# On-demand scenes implementation plan

**Goal:** Open catalog and historical scenes on demand under one disposable cache budget, preserving personal records.

**Architecture:** Keep executable engines in the reviewed application bundle. Catalog entries reference immutable manifests; manifests name an installed engine and hash-addressed data. A shared cache coordinator reserves all dependencies before transfers, deduplicates disk files, updates true LRU on reads, and protects active leases. Personal scene records extend the existing durable core save.

**Constraints:** 256 MiB default total cache; configurable budget; existing shader libraries retained; no notification backend, remote script execution, or automatic offline pinning of favorites. No changes committed or pushed without the user's request. The user explicitly requested implementation without repeated design approval; proceed inline.

## Work

- [x] Cache coordinator and native/Web drivers: test real policy using in-memory disk and native API boundary doubles. Cover LRU hits, shared hashes, reservations, cancellation, partial writes, corruption, budget exhaustion and restart reconciliation.
- [x] Generic catalog/manifest manager: metadata-only listing/recommendation; cache-first open with missing-resource repair; installed engine compatibility; bounded metadata; cancellation and progress; saved manifests for offline/restart.
- [x] Durable scene records and application integration: independent woodfish/spring/water engines, history reopening and checkpoints; explicit loading/error/retry; cache occupancy, budget and clear controls; lifecycle maintenance.
- [x] Publishing fixtures, browser acceptance and documentation: full unit suite, Vite build, Expo Android/iOS embedded bundle checks, browser lifecycle/network/offline checks. Clearly separate these from device acceptance.

## Review focus

Concurrent consumers cancelling independently; active dependencies exceeding a lowered budget; externally deleted/corrupt cached files; incompatible catalog revisions versus saved progress; native WebView restart leaving stale leases. Each needs a specific regression test or a documented device check.

## Execution evidence (2026-09-24)

`npm run verify` passed: 102 unit tests, both woodfish asset budgets, Vite production build, mobile TypeScript, and Android/iOS native plus embedded DOM checks. Browser scripts passed: scene library (500 entries, cache/download/clear/history/offline/corruption/cancel/retry, real reduced-motion water gesture), shader overlay and woodfish pointer interactions. The library loop created and lost 9 contexts; 0 GPU resources remained live, peak 22 in its instrumented procedural-scene fixture.

Read-only independent review identified two important defects; both were reproduced RED then fixed GREEN: queued cancellation retaining reservations, and reduced motion freezing gesture hold timers. Browser acceptance identified separate Web clients having different protection maps and a mobile debug toggle blocking navigation; both were fixed. Native cancellation now retains capacity until the installed Expo `cancelAsync` acknowledges stop, with a gated acknowledgment regression test.

Decisions: history reopens its saved immutable descriptor; choosing an updated directory entry refreshes that scene's descriptor only within the same engine contract. The history view retains all user records; pagination of a very large personal history remains a UI scalability follow-up. Native URI access, cancellation timing and process recovery need device acceptance. Web live leases are shared within one DOM host, not across separate browser tabs.

Documentation sources: actual cache/catalog/core/engine code and verification outputs; Expo DOM/FileSystem, Apple guidelines and Google Play policy fetched from official sources. The Chinese documentation skill's knowledge index had no Expo/Three.js/WebGL/LRU matches; repository code and official documents supply the technical details.

Git: work began clean at `24eda1b`; external Cursor-attributed commits appeared during execution. No commits, resets or pushes were performed by this agent; external commits and remaining worktree edits were preserved.

The legacy content browser suite also passed after its metadata helper was corrected to select the woodfish versioned metadata rather than assume the first IndexedDB record. It covers pending/confirmed rollback, offline reads, quota failure, interrupted updates, audio, GPU fallback and unsupported engines. A final Vite build after the history empty-state correction passed; `git diff --check` was clean.
