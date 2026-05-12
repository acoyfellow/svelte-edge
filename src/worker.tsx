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
        const sourceHash = await sha256(source);
        const key = `svelte:${VERSION}:${mode}:${sourceHash}`;
        const cached = (await env.SVELTE_EDGE_CACHE?.get(key, "json")) as Record<string, unknown> | null;
        if (cached) {
          const totalMs = +(performance.now() - startedAt).toFixed(2);
          return json({ ...cached, cache: "hit", requestId: rid }, {}, {
            "server-timing": `total;dur=${totalMs}, cache;desc=hit`
          });
        }

        const compileStart = performance.now();
        let result;
        try {
          result = compile(source, { generate: mode, dev: false, name: "EdgeComponent" });
        } catch (err) {
          throw new HttpError("compile_error", err instanceof Error ? err.message : String(err), 400);
        }
        const compileMs = +(performance.now() - compileStart).toFixed(2);

        const payload = {
          svelte: VERSION,
          mode,
          compileMs,
          warnings: result.warnings.map((w) => ({ code: w.code, message: w.message })),
          jsBytes: result.js.code.length,
          cssBytes: result.css?.code.length ?? 0,
          js: result.js.code,
          css: result.css?.code ?? ""
        };

        // Cache write path. Three modes:
        // 1. Coordinator bound: route write through DO for single-flight.
        //    Coordinator may return an existing payload if another writer
        //    landed first ("coalesced") or KV hit between this isolate's
        //    initial read and the DO's recheck ("hit").
        // 2. KV bound, no coordinator: fire-and-forget waitUntil write.
        // 3. Neither bound: no caching, miss every time.
        let cacheTag: "miss" | "coalesced" | "hit" = "miss";
        let returnedPayload: Record<string, unknown> = payload;
        if (env.SVELTE_EDGE_COORDINATOR) {
          try {
            const stub = env.SVELTE_EDGE_COORDINATOR.get(env.SVELTE_EDGE_COORDINATOR.idFromName(key));
            const coordRes = await stub.fetch("https://coordinator/coordinate", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ key, payload, ttlSeconds: CACHE_TTL_SECONDS })
            });
            if (coordRes.ok) {
              const cr = (await coordRes.json()) as {
                payload: Record<string, unknown>;
                cache: "miss" | "coalesced" | "hit";
              };
              cacheTag = cr.cache;
              returnedPayload = cr.payload;
            } else {
              // Coordinator failed; fall back to direct KV write so the request still succeeds.
              if (env.SVELTE_EDGE_CACHE) {
                ctx.waitUntil(env.SVELTE_EDGE_CACHE.put(key, JSON.stringify(payload), { expirationTtl: CACHE_TTL_SECONDS }));
              }
            }
          } catch {
            // Same fallback on thrown errors.
            if (env.SVELTE_EDGE_CACHE) {
              ctx.waitUntil(env.SVELTE_EDGE_CACHE.put(key, JSON.stringify(payload), { expirationTtl: CACHE_TTL_SECONDS }));
            }
          }
        } else if (env.SVELTE_EDGE_CACHE) {
          ctx.waitUntil(env.SVELTE_EDGE_CACHE.put(key, JSON.stringify(payload), { expirationTtl: CACHE_TTL_SECONDS }));
        }

        const totalMs = +(performance.now() - startedAt).toFixed(2);
        return json({ ...returnedPayload, cache: cacheTag, requestId: rid }, {}, {
          "server-timing": `total;dur=${totalMs}, compile;dur=${compileMs}, cache;desc=${cacheTag}`
        });
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
