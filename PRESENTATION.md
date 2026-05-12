# svelte-edge presentation notes

## What exists

A minimal Cloudflare Worker that bundles `svelte/compiler` and exposes:

- `GET /` demo form
- `POST /compile?mode=client` -> compiled client JS/CSS
- `POST /compile?mode=server` -> compiled SSR JS/CSS
- optional KV cache via `SVELTE_EDGE_CACHE`

## Commands verified

```sh
npm run check
npm run bench:local
npm run report
npm run build
```

## Current results

Worker dry-run build:

- upload: ~1682 KiB
- gzip: ~306 KiB

Local compiler benchmark (`npm run report`, 25 iterations/case):

| case | mode | median | p95 | source | output JS gzip |
|---|---:|---:|---:|---:|---:|
| tiny | client | 0.18ms | 1.90ms | 19B | 202B |
| tiny | server | 0.04ms | 0.33ms | 19B | 139B |
| stateful | client | 0.39ms | 1.37ms | 146B | 323B |
| stateful | server | 0.20ms | 0.56ms | 146B | 176B |
| list | client | 0.36ms | 1.05ms | 171B | 401B |
| list | server | 0.28ms | 0.63ms | 171B | 350B |
| nestedish | client | 0.35ms | 1.15ms | 216B | 533B |
| nestedish | server | 0.34ms | 0.58ms | 216B | 373B |

## Early read

Promising for edge compile-on-miss: the compiler bundles smaller than expected and local compile times for small components are sub-ms after warmup. This supports experiments for REPLs, previews, CMS snippets, tenant themes, and component CDNs.

Not yet proven: actual workerd CPU/cold-start behavior, SSR module evaluation, imports/dependency graphs, client hydration assets, and concurrency/cache stampede behavior.

## Next experiments

1. Run under `wrangler dev` and benchmark HTTP `/compile` latency.
2. Add a Durable Object compile coordinator for single-flight cache misses.
3. Store compiled artifacts in R2 or KV with keys including Svelte version + mode + source hash.
4. Evaluate SSR output safely and return rendered HTML.
5. Add import resolution for a tiny source-deployed route graph.
6. Trigger background compilation via Workflows for larger apps.

## HTTP benchmark under `wrangler dev`

Added `npm run bench:http -- <url> <iterations>`.

Local run against `wrangler dev`:

```txt
first { status: 200, cache: 'miss', compileMs: 22, jsBytes: 551 }
medianMs: 2.21
p95Ms: 51.78
minMs: 1.38
maxMs: 51.78
```

Wrangler request logs after warmup were mostly 1-2ms, first compile request 26ms. No KV binding was configured, so every request was a compile miss; this is measuring warm compiler-in-isolate behavior, not cache hits.

## SSR evaluation attempt

A parallel agent implemented a `/render` proof by compiling with `generate: "server"`, rewriting the compiler output's `import * as $ from 'svelte/internal/server'`, and evaluating it with `new Function` plus `svelte/server.render`.

This surfaced two important constraints:

1. Importing `svelte/server` pulls `node:async_hooks`, so the Worker needs `compatibility_flags = ["nodejs_compat"]`. With that flag, dry-run build succeeds at ~1769.68 KiB / 326.34 KiB gzip.
2. Workerd disallows string code generation in this context: `/render` currently fails with `Code generation from strings disallowed for this context`.

Conclusion: server compilation is proven, but same-isolate arbitrary SSR evaluation is not viable via `new Function`. The better next path is one of:

- Dynamic Worker per compiled artifact
- Workflow/background bundling into deployable modules
- a constrained renderer/interpreter experiment
- transform output into a predeclared module shape at build time rather than request-time eval

## Durable Object coordinator prototype

Added `src/cache-coordinator.ts` and `DO-COORDINATOR.md`.

Current coordinator is optional and safe:

- Worker checks KV first.
- On miss, Worker compiles.
- If `SVELTE_EDGE_COORDINATOR` is bound, Worker sends compiled payload to a DO keyed by artifact hash.
- DO re-checks KV, coalesces concurrent writes, writes artifact once, returns `miss`, `hit`, or `coalesced`.

Important limitation: this deduplicates cache writes, not compile CPU, because the Worker still compiles before calling the DO. True compile single-flight would move compilation into the DO and send source/mode to the DO.

Build after DO export + SSR runtime:

```txt
Total Upload: 1774.24 KiB / gzip: 327.47 KiB
```

## Concurrent compile benchmark under `wrangler dev`

Added `npm run bench:concurrent -- <url> <concurrency>`.

Local run: 50 concurrent identical POSTs, no KV/DO binding configured.

```txt
statuses: { 200: 50 }
caches: { miss: 50 }
totalMs: 84.11
medianMs: 60.44
p95Ms: 65.81
```

Wrangler logs showed each request completing in ~22-40ms. Since no cache binding existed, all 50 compiled independently. This is the stampede scenario that motivates moving true compile single-flight into a Durable Object, not just write coalescing.
