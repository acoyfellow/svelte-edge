# svelte-edge

Public experiment repo for `acoyfellow/svelte-edge`.

Goal: test whether Cloudflare Workers can carry enough of the Svelte compiler/runtime to make a “non-compiler Svelte/Kit” plausible: deploy source, compile on-demand or in background, cache artifacts at the edge, and render from Workers.

## Questions

- Can `svelte/compiler` bundle into a Worker cleanly?
- What is cold-start + compile latency for small/medium/large components?
- Is request-time compile useful for REPLs, previews, CMS pages, tenant themes, or route-level source deploys?
- Where do Durable Objects, KV/R2, Workflows, and Dynamic Workers fit?

## Prototype 0: Worker compiler endpoint

```sh
npm install
npm run dev
```

Then open `/`, or POST source directly:

```sh
curl -X POST 'http://localhost:8787/compile?mode=client' \
  --data '<h1>Hello {name}</h1><script>export let name = "edge";</script>'
```

Run a local Node-side baseline:

```sh
npm run bench:local
```

## Cache

The Worker can use a KV namespace named `SVELTE_EDGE_CACHE`, but it also runs without one.

```sh
wrangler kv namespace create SVELTE_EDGE_CACHE
```

Add the generated namespace id to `wrangler.toml`.

## Experiment log

1. Bundle compiler into Worker.
2. Measure compile latency and Worker bundle size.
3. Add artifact cache keyed by `svelte version + mode + source hash`.
4. Add Durable Object single-flight for cache misses.
5. Try SSR module evaluation and minimal hydration asset serving.
6. Compare request-time compile vs Workflow/background compile.

## Deploy

Deploys are handled by GitHub Actions for the public `acoyfellow/svelte-edge` repo. See [`GITHUB-DEPLOY.md`](./GITHUB-DEPLOY.md).
