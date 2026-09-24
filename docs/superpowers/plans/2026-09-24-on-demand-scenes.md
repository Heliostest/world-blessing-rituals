# On-demand scenes implementation plan

**Goal:** Open catalog and historical scenes on demand under one disposable cache budget, preserving personal records.

**Architecture:** Keep executable engines in the reviewed application bundle. Catalog entries reference immutable manifests; manifests name an installed engine and hash-addressed data. A shared cache coordinator reserves all dependencies before transfers, deduplicates disk files, updates true LRU on reads, and protects active leases. Personal scene records extend the existing durable core save.

**Constraints:** 256 MiB default total cache; configurable budget; existing shader libraries retained; no notification backend, remote script execution, or automatic offline pinning of favorites. No changes committed or pushed without the user's request. The user explicitly requested implementation without repeated design approval; proceed inline.

## Work

- [ ] Cache coordinator and native/Web drivers: test real policy using in-memory disk and native API boundary doubles. Cover LRU hits, shared hashes, reservations, cancellation, partial writes, corruption, budget exhaustion and restart reconciliation.
- [ ] Generic catalog/manifest manager: metadata-only listing/recommendation; cache-first open with missing-resource repair; installed engine compatibility; bounded metadata; cancellation and progress; saved manifests for offline/restart.
- [ ] Durable scene records and application integration: independent woodfish/spring/water engines, history reopening and checkpoints; explicit loading/error/retry; cache occupancy, budget and clear controls; lifecycle maintenance.
- [ ] Publishing fixtures, browser acceptance and documentation: full unit suite, Vite build, Expo Android/iOS embedded bundle checks, browser lifecycle/network/offline checks. Clearly separate these from device acceptance.

## Review focus

Concurrent consumers cancelling independently; active dependencies exceeding a lowered budget; externally deleted/corrupt cached files; incompatible catalog revisions versus saved progress; native WebView restart leaving stale leases. Each needs a specific regression test or a documented device check.
