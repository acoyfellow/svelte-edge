const endpoint = process.argv[2] ?? "http://localhost:8787/compile?mode=client";
const concurrency = Number(process.argv[3] ?? 25);
const source = `<script>let count = 0;</script>\n<button onclick={() => count += 1}>count: {count}</button>`;

const started = performance.now();
const results = await Promise.all(Array.from({ length: concurrency }, async (_, i) => {
  const t0 = performance.now();
  const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "text/plain" }, body: source });
  const text = await res.text();
  const t1 = performance.now();
  let body: any;
  try { body = JSON.parse(text); } catch { body = { text }; }
  return { i, status: res.status, ms: +(t1 - t0).toFixed(2), cache: body.cache, compileMs: body.compileMs, error: body.error?.code };
}));
const totalMs = +(performance.now() - started).toFixed(2);
const times = results.map((r) => r.ms).sort((a, b) => a - b);
console.table(results.slice(0, 10));
function counts(key: "status" | "cache") {
  const out: Record<string, number> = {};
  for (const r of results) out[String(r[key])] = (out[String(r[key])] ?? 0) + 1;
  return out;
}
console.log({ endpoint, concurrency, totalMs, medianMs: times[Math.floor(times.length / 2)], p95Ms: times[Math.floor(times.length * 0.95)], statuses: counts("status"), caches: counts("cache") });
export {};
