# svelte-edge

Agents can write Svelte now.

`svelte-edge` is a Cloudflare Workers demo where a chat agent generates Svelte 5, the Worker compiles it at the edge, and the live component appears inline in the conversation. The component can send structured data back to the host page with `postMessage`, so the agent can continue the workflow.

Live demo:

- https://svelte-edge.coy.workers.dev
- Target custom domain: https://svelte-edge.coey.dev

Repo:

- https://github.com/acoyfellow/svelte-edge

## What it demonstrates

- **Agent-generated UI** — Kimi K2.6 via Workers AI writes Svelte 5 source.
- **Edge compile** — the Worker compiles generated source with `svelte/compiler`.
- **Inline components** — the browser mounts the compiled component inside the chat.
- **Structured return path** — generated UI can call `parent.postMessage(...)` to hand data back to the agent.
- **Edge bundles** — source can be turned into stable bundle URLs: `client.js`, `server.js`, `style.css`, `preview.html`, and `manifest.json`.

## Quick start

```sh
npm install
npm run dev
```

Open:

```txt
http://localhost:8787
```

Useful routes:

```txt
/                         agent-first homepage
/playground               source editor + preview + bundle inspector
/examples                 curated Svelte 5 examples
/docs                     docs
/health                   health check
```

## API

Compile client or server output directly:

```sh
curl -sX POST 'http://localhost:8787/compile?mode=client' \
  -H 'content-type: text/plain' \
  --data '<script>let count = $state(0);</script><button onclick={() => count += 1}>{count}</button>'
```

Create an edge bundle:

```sh
curl -sX POST 'http://localhost:8787/bundles' \
  -H 'content-type: text/plain' \
  --data '<script>let count = $state(0);</script><button onclick={() => count += 1}>{count}</button>'
```

Generate UI with Workers AI:

```sh
curl -sX POST 'http://localhost:8787/agent/generate-ui' \
  -H 'content-type: application/json' \
  --data '{"prompt":"Make a pricing plan picker with Starter, Pro, and Business options"}'
```

## Bundle routes

```txt
POST /bundles
GET  /bundles/:hash/client.js
GET  /bundles/:hash/server.js
GET  /bundles/:hash/style.css
GET  /bundles/:hash/preview.html
GET  /bundles/:hash/manifest.json
```

`/artifacts` still exists as a compatibility alias, but public docs and UI use **bundles** to avoid confusion with Cloudflare Artifacts.

## Workers AI model

The agent endpoint uses:

```txt
@cf/moonshotai/kimi-k2.6
```

Wrangler binding:

```toml
[ai]
binding = "AI"
```

## Cache / stable bundle URLs

The Worker can run without KV, but stable `GET /bundles/:hash/...` retrieval needs a KV namespace:

```sh
wrangler kv namespace create SVELTE_EDGE_CACHE
```

Then add the generated binding to `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "SVELTE_EDGE_CACHE"
id = "..."
```

## Development commands

```sh
npm run check       # generate CSS/OG assets + typecheck
npm run build       # dry-run Wrangler build
npm run deploy      # deploy Worker
npm run bench:local # local compiler baseline
npm run bench:http  # deployed/local HTTP benchmark
```

## Notes

- This is a demo/prototype, not a replacement for the Svelte Playground.
- The SSR path is experimental because `new Function` style evaluation is restricted in `workerd`.
- The main product idea is: **chat → Svelte 5 source → edge bundle → inline UI → structured result back to the agent**.
