# Durable Object compile coordinator

Goal: avoid cache stampedes when many isolates see the same uncached Svelte source at once.

## Current prototype

`src/cache-coordinator.ts` exports `CacheCoordinator`, a Durable Object keyed by the same artifact key as KV:

```txt
svelte:<svelte version>:<mode>:<source sha256>
```

The Worker does this on `/compile`:

1. Check KV directly. If hit, return without DO.
2. Compile locally on miss.
3. If `SVELTE_EDGE_COORDINATOR` is bound, send `{ key, payload, ttlSeconds }` to `idFromName(key)`.
4. The DO re-checks KV, coalesces concurrent writes for the same key, writes once, and returns `miss`, `hit`, or `coalesced`.

This is intentionally safe/optional. Without the binding, the Worker still works.

## Important limitation

This version deduplicates **writes**, not **compiles**. The caller still compiles before asking the DO to coordinate the write.

A stronger version would send `{ source, mode }` to the DO and have the DO compile exactly once. That would reduce CPU during stampedes, but it moves the Svelte compiler into the DO path and makes the DO a heavier execution island.

## Enable

Uncomment in `wrangler.toml`:

```toml
[[durable_objects.bindings]]
name = "SVELTE_EDGE_COORDINATOR"
class_name = "CacheCoordinator"

[[migrations]]
tag = "v1-coordinator"
new_sqlite_classes = ["CacheCoordinator"]
```

Then deploy.

## Next version

- Move compile into the DO for true single-flight compile misses.
- Keep KV as global artifact storage.
- Add `/debug` sampling only in dev.
- Measure burst traffic: 1, 10, 100 concurrent identical source requests.
