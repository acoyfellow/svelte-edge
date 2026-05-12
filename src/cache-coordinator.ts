// CacheCoordinator: a Durable Object that single-flights compile requests.
//
// Why: when many concurrent requests hit the worker for the same uncached
// (svelte version, mode, source hash) tuple, every isolate that takes the
// request will independently compile and write to KV. That is wasted CPU and
// duplicate KV writes. With a coordinator we route by key to a single DO
// instance, and the DO serializes concurrent work for the same key inside its
// isolate.
//
// Design constraints:
// - The DO must not depend on the Svelte compiler itself (keeps the DO bundle
//   small and avoids re-importing the compiler in another isolate). The DO
//   asks the calling worker to do the compile by accepting an inbound
//   `compiled` payload, OR it accepts a one-shot compile request where the
//   parent worker compiles inside `coordinate()` (current path).
// - Routing is keyed by the same cache key the worker computes. We use
//   `idFromName(key)` so every isolate hashing the same key lands on the same
//   DO instance.
// - In-memory inflight map deduplicates within a single DO. KV is still the
//   shared cache across DOs/colos, so cold isolates can hit KV directly via
//   the worker before involving the DO.
//
// This file is intentionally framework-light: it imports nothing from
// `src/worker.ts` to keep the dependency direction one-way.

export interface CoordinatorEnv {
  SVELTE_EDGE_CACHE?: KVNamespace;
}

export interface CoordinatePayload {
  key: string;
  // The serialized JSON payload the worker would otherwise write to KV.
  payload: Record<string, unknown>;
  ttlSeconds: number;
}

// Shape returned to the worker after coordination.
export interface CoordinateResult {
  payload: Record<string, unknown>;
  cache: "hit" | "miss" | "coalesced";
  coordinator: { instanceKey: string; inflight: number };
}

const INFLIGHT_LIMIT = 64; // cap concurrent distinct keys per DO instance

export class CacheCoordinator implements DurableObject {
  private state: DurableObjectState;
  private env: CoordinatorEnv;
  // key -> resolver promise of the compiled payload
  private inflight = new Map<string, Promise<Record<string, unknown>>>();

  constructor(state: DurableObjectState, env: CoordinatorEnv) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/coordinate") {
      return this.handleCoordinate(request);
    }
    if (request.method === "GET" && url.pathname === "/debug") {
      return new Response(
        JSON.stringify({
          inflight: this.inflight.size,
          keys: [...this.inflight.keys()].slice(0, 16)
        }),
        { headers: { "content-type": "application/json" } }
      );
    }
    return new Response("not found", { status: 404 });
  }

  // The worker calls this with the cache key and the already-compiled payload
  // it would have written to KV. The coordinator:
  //   1. Re-checks KV (another DO/colo may have raced ahead).
  //   2. If miss, writes payload to KV, returns it tagged "miss".
  //   3. If a write for the same key is in-flight, awaits it and returns
  //      "coalesced".
  //
  // Tradeoffs:
  // - The worker still compiles. This DO does *write* deduplication, not
  //   *compile* deduplication across isolates. To deduplicate compile work
  //   across isolates, the worker would need to send the source to the DO and
  //   have the DO own compile. That's a heavier prototype; tracked in
  //   DO-COORDINATOR.md.
  private async handleCoordinate(request: Request): Promise<Response> {
    let body: CoordinatePayload;
    try {
      body = (await request.json()) as CoordinatePayload;
    } catch (err) {
      return jsonResp({ error: { code: "bad_body", message: (err as Error).message } }, 400);
    }
    if (!body || typeof body.key !== "string" || !body.payload) {
      return jsonResp({ error: { code: "bad_body", message: "key and payload required" } }, 400);
    }

    const { key, payload, ttlSeconds } = body;
    const kv = this.env.SVELTE_EDGE_CACHE;

    // 1. KV re-check.
    if (kv) {
      const existing = (await kv.get(key, "json")) as Record<string, unknown> | null;
      if (existing) {
        return jsonResp(<CoordinateResult>{
          payload: existing,
          cache: "hit",
          coordinator: { instanceKey: this.state.id.toString(), inflight: this.inflight.size }
        });
      }
    }

    // 2. Coalesce concurrent writers for the same key inside this DO.
    const existing = this.inflight.get(key);
    if (existing) {
      const coalesced = await existing;
      return jsonResp(<CoordinateResult>{
        payload: coalesced,
        cache: "coalesced",
        coordinator: { instanceKey: this.state.id.toString(), inflight: this.inflight.size }
      });
    }

    if (this.inflight.size >= INFLIGHT_LIMIT) {
      return jsonResp(
        { error: { code: "coordinator_overloaded", message: `inflight cap ${INFLIGHT_LIMIT}` } },
        503
      );
    }

    // 3. Own the write.
    const work = (async () => {
      if (kv) {
        await kv.put(key, JSON.stringify(payload), { expirationTtl: ttlSeconds });
      }
      return payload;
    })();
    this.inflight.set(key, work);
    try {
      const settled = await work;
      return jsonResp(<CoordinateResult>{
        payload: settled,
        cache: "miss",
        coordinator: { instanceKey: this.state.id.toString(), inflight: this.inflight.size }
      });
    } finally {
      this.inflight.delete(key);
    }
  }
}

function jsonResp(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
