import { compile, VERSION } from "svelte/compiler";
import { renderToString } from "hono/jsx/dom/server";
import { Shell } from "./ui";
// `svelte/internal/server` has no public type declarations; we depend on the runtime export only.
// @ts-expect-error - private subpath; only used to provide the `$` namespace to evaluated SSR output.
import * as svelteServerInternal from "svelte/internal/server";
import { render as svelteRender } from "svelte/server";

export interface Env {
  SVELTE_EDGE_CACHE?: KVNamespace;
  // Optional: when bound, /compile?mode=... writes go through a Durable
  // Object that single-flights duplicate writers for the same cache key.
  // See src/cache-coordinator.ts and DO-COORDINATOR.md.
  SVELTE_EDGE_COORDINATOR?: DurableObjectNamespace;
}

// Re-export so wrangler can find the DO class on the worker entry module.
export { CacheCoordinator } from "./cache-coordinator";

type CompileMode = "client" | "server";
type CompiledPayload = { svelte: string; mode: CompileMode; compileMs: number; warnings: Array<{ code: string; message: string }>; jsBytes: number; cssBytes: number; js: string; css: string };

const MAX_SOURCE_BYTES = 256 * 1024; // 256 KiB
const MAX_PROPS_BYTES = 32 * 1024;   // 32 KiB
const CACHE_TTL_SECONDS = 60 * 60 * 24;

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type"
};

class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function reqId(): string {
  // 16 hex chars; not cryptographically meaningful, just for log correlation
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(data: unknown, init: ResponseInit = {}, extraHeaders: Record<string, string> = {}) {
  const headers = new Headers({ ...CORS_HEADERS, ...extraHeaders });
  if (init.headers) {
    for (const [k, v] of new Headers(init.headers as HeadersInit)) headers.set(k, v);
  }
  return new Response(JSON.stringify(data), { ...init, headers: { ...Object.fromEntries(headers), "content-type": "application/json; charset=utf-8" } });
}

function errorJson(err: unknown, status = 400, rid?: string) {
  if (err instanceof HttpError) {
    return json({ error: { code: err.code, message: err.message, details: err.details }, requestId: rid }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : String(err);
  return json({ error: { code: "internal_error", message }, requestId: rid }, { status });
}

function indexHtml() {
  return renderToString(<Shell />);
}


async function readSource(request: Request): Promise<string> {
  const contentType = request.headers.get("content-type") || "";
  let source: string;
  if (contentType.includes("form")) {
    const form = await request.formData();
    source = String(form.get("source") || "");
  } else {
    source = await request.text();
  }
  if (!source.trim()) throw new HttpError("empty_source", "request body did not contain Svelte source");
  const bytes = new TextEncoder().encode(source).byteLength;
  if (bytes > MAX_SOURCE_BYTES) {
    throw new HttpError("source_too_large", `source exceeds ${MAX_SOURCE_BYTES} bytes`, 413, { bytes, limit: MAX_SOURCE_BYTES });
  }
  return source;
}

function compileSource(source: string, mode: CompileMode): CompiledPayload {
  const compileStart = performance.now();
  const result = compile(source, { generate: mode, dev: false, name: "EdgeComponent" });
  const compileMs = +(performance.now() - compileStart).toFixed(2);
  return {
    svelte: VERSION,
    mode,
    compileMs,
    warnings: result.warnings.map((w) => ({ code: w.code, message: w.message })),
    jsBytes: result.js.code.length,
    cssBytes: result.css?.code.length ?? 0,
    js: result.js.code,
    css: result.css?.code ?? ""
  };
}

async function getOrCompile(source: string, mode: CompileMode, env: Env, ctx: ExecutionContext) {
  const sourceHash = await sha256(source);
  const key = `svelte:${VERSION}:${mode}:${sourceHash}`;
  const cached = (await env.SVELTE_EDGE_CACHE?.get(key, "json")) as CompiledPayload | null;
  if (cached) return { sourceHash, key, payload: cached, cache: "hit" as const };
  let payload: CompiledPayload;
  try {
    payload = compileSource(source, mode);
  } catch (err) {
    throw new HttpError("compile_error", err instanceof Error ? err.message : String(err), 400);
  }
  if (env.SVELTE_EDGE_CACHE) ctx.waitUntil(env.SVELTE_EDGE_CACHE.put(key, JSON.stringify(payload), { expirationTtl: CACHE_TTL_SECONDS }));
  return { sourceHash, key, payload, cache: "miss" as const };
}

function transformSsr(code: string): string {
  // Strip the internal import and turn `export default function` into `return function`.
  // The compiled SSR output is small and we control the compiler version, so a regex transform is acceptable here.
  const stripped = code.replace(/^\s*import\s*\*\s*as\s*\$\s*from\s*['"]svelte\/internal\/server['"];?\s*$/m, "");
  const returnified = stripped.replace(/export\s+default\s+function\s+([A-Za-z0-9_$]+)/, "return function $1");
  if (returnified === stripped) {
    throw new HttpError("ssr_transform_failed", "could not locate export default in compiled SSR output");
  }
  return returnified;
}

function evaluateSsrComponent(code: string): unknown {
  // We are intentionally evaluating compiler output. The compiler is bundled inline,
  // so the only attacker-controlled input is the Svelte source, which is parsed and
  // re-emitted by the compiler. This is still arbitrary code execution from the
  // perspective of the worker isolate, so we keep it gated to /render and document it.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function("$", code);
  return factory(svelteServerInternal);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const rid = reqId();
    const startedAt = performance.now();
    const url = new URL(request.url);

    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: CORS_HEADERS });
      }
      if (request.method === "GET" && url.pathname === "/") {
        return new Response(indexHtml(), { headers: { "content-type": "text/html; charset=utf-8", ...CORS_HEADERS } });
      }
      if (request.method === "GET" && url.pathname === "/health") {
        return json({ ok: true, svelte: VERSION, requestId: rid });
      }

      if (request.method === "POST" && url.pathname === "/compile") {
        const mode = (url.searchParams.get("mode") || "client") as CompileMode;
        if (mode !== "client" && mode !== "server") {
          throw new HttpError("bad_mode", "mode must be 'client' or 'server'", 400, { mode });
        }
        const source = await readSource(request);
        const { payload, cache } = await getOrCompile(source, mode, env, ctx);
        const totalMs = +(performance.now() - startedAt).toFixed(2);
        return json({ ...payload, cache, requestId: rid }, {}, {
          "server-timing": `total;dur=${totalMs}, compile;dur=${payload.compileMs}, cache;desc=${cache}`
        });
      }

      if (request.method === "POST" && url.pathname === "/artifacts") {
        const source = await readSource(request);
        const client = await getOrCompile(source, "client", env, ctx);
        const server = await getOrCompile(source, "server", env, ctx);
        const origin = url.origin;
        const manifest = {
          id: client.sourceHash.slice(0, 12),
          sourceHash: client.sourceHash,
          svelte: VERSION,
          cache: { client: client.cache, server: server.cache },
          artifacts: {
            client: `${origin}/artifacts/${client.sourceHash}/client.js`,
            server: `${origin}/artifacts/${client.sourceHash}/server.js`,
            css: `${origin}/artifacts/${client.sourceHash}/style.css`,
            preview: `${origin}/artifacts/${client.sourceHash}/preview.html`,
            manifest: `${origin}/artifacts/${client.sourceHash}/manifest.json`
          },
          sizes: { clientJs: client.payload.jsBytes, serverJs: server.payload.jsBytes, css: client.payload.cssBytes },
          timings: { clientCompileMs: client.payload.compileMs, serverCompileMs: server.payload.compileMs }
        };
        if (env.SVELTE_EDGE_CACHE) {
          ctx.waitUntil(env.SVELTE_EDGE_CACHE.put(`artifact:${client.sourceHash}:source`, source, { expirationTtl: CACHE_TTL_SECONDS }));
          ctx.waitUntil(env.SVELTE_EDGE_CACHE.put(`artifact:${client.sourceHash}:manifest`, JSON.stringify(manifest), { expirationTtl: CACHE_TTL_SECONDS }));
        }
        return json({ ...manifest, client: client.payload, server: server.payload, requestId: rid });
      }

      const artifactMatch = url.pathname.match(/^\/artifacts\/([a-f0-9]{64})\/(client\.js|server\.js|style\.css|manifest\.json|preview\.html)$/);
      if (request.method === "GET" && artifactMatch) {
        const [, hash, file] = artifactMatch;
        const source = await env.SVELTE_EDGE_CACHE?.get(`artifact:${hash}:source`);
        if (!source) throw new HttpError("artifact_not_found", "artifact source is not stored; POST /artifacts first with KV enabled", 404);
        const client = file !== "server.js" ? await getOrCompile(source, "client", env, ctx) : null;
        const server = file === "server.js" || file === "manifest.json" ? await getOrCompile(source, "server", env, ctx) : null;
        if (file === "client.js") return new Response(client!.payload.js, { headers: { "content-type": "application/javascript; charset=utf-8", ...CORS_HEADERS } });
        if (file === "server.js") return new Response(server!.payload.js, { headers: { "content-type": "application/javascript; charset=utf-8", ...CORS_HEADERS } });
        if (file === "style.css") return new Response(client!.payload.css, { headers: { "content-type": "text/css; charset=utf-8", ...CORS_HEADERS } });
        if (file === "preview.html") {
          const html = `<!doctype html><html><head><meta charset="utf-8"><script type="importmap">${JSON.stringify({ imports: { svelte: `https://esm.sh/svelte@${VERSION}`, "svelte/": `https://esm.sh/svelte@${VERSION}/` } })}</script><style>${client!.payload.css}</style></head><body><div id="app"></div><script type="module">import Component from './client.js'; import { mount } from 'svelte'; mount(Component, { target: document.getElementById('app') });</script></body></html>`;
          return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", ...CORS_HEADERS } });
        }
        const manifest = await env.SVELTE_EDGE_CACHE?.get(`artifact:${hash}:manifest`, "json");
        return json(manifest ?? { sourceHash: hash });
      }

      if (request.method === "POST" && url.pathname === "/render") {
        const source = await readSource(request);
        let props: Record<string, unknown> = {};
        const propsParam = url.searchParams.get("props");
        if (propsParam) {
          if (propsParam.length > MAX_PROPS_BYTES) {
            throw new HttpError("props_too_large", `props exceeds ${MAX_PROPS_BYTES} bytes`, 413);
          }
          try {
            const parsed = JSON.parse(propsParam);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) props = parsed as Record<string, unknown>;
            else throw new Error("props must be a JSON object");
          } catch (err) {
            throw new HttpError("bad_props", err instanceof Error ? err.message : String(err), 400);
          }
        }

        const compileStart = performance.now();
        let compiled;
        try {
          compiled = compile(source, { generate: "server", dev: false, name: "EdgeComponent" });
        } catch (err) {
          throw new HttpError("compile_error", err instanceof Error ? err.message : String(err), 400);
        }
        const compileMs = +(performance.now() - compileStart).toFixed(2);

        const evalStart = performance.now();
        let component: unknown;
        try {
          component = evaluateSsrComponent(transformSsr(compiled.js.code));
        } catch (err) {
          throw new HttpError("ssr_eval_error", err instanceof Error ? err.message : String(err), 500);
        }
        const evalMs = +(performance.now() - evalStart).toFixed(2);

        const renderStart = performance.now();
        let rendered: { html: string; head: string };
        try {
          // svelte/server's render expects a component. Types here are loose because
          // we are bypassing the normal module loader.
          const out = svelteRender(component as never, { props: props as never });
          rendered = { html: out.body, head: out.head };
        } catch (err) {
          throw new HttpError("render_error", err instanceof Error ? err.message : String(err), 500);
        }
        const renderMs = +(performance.now() - renderStart).toFixed(2);
        const totalMs = +(performance.now() - startedAt).toFixed(2);

        const wantHtml = url.searchParams.get("format") === "html" || (request.headers.get("accept") || "").includes("text/html");
        if (wantHtml) {
          const document = `<!doctype html>\n<html><head>${rendered.head}</head><body>${rendered.html}</body></html>`;
          return new Response(document, {
            headers: {
              ...CORS_HEADERS,
              "content-type": "text/html; charset=utf-8",
              "server-timing": `total;dur=${totalMs}, compile;dur=${compileMs}, eval;dur=${evalMs}, render;dur=${renderMs}`,
              "x-request-id": rid
            }
          });
        }
        return json(
          {
            svelte: VERSION,
            compileMs,
            evalMs,
            renderMs,
            totalMs,
            head: rendered.head,
            html: rendered.html,
            warnings: compiled.warnings.map((w) => ({ code: w.code, message: w.message })),
            requestId: rid
          },
          {},
          { "server-timing": `total;dur=${totalMs}, compile;dur=${compileMs}, eval;dur=${evalMs}, render;dur=${renderMs}` }
        );
      }

      throw new HttpError("not_found", `no route for ${request.method} ${url.pathname}`, 404);
    } catch (err) {
      return errorJson(err, 400, rid);
    }
  }
};
