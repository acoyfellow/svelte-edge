const endpoint = process.argv[2] ?? "http://localhost:8787/compile?mode=client";
const iterations = Number(process.argv[3] ?? 25);
const source = `<script>let count = 0;</script>\n<button onclick={() => count += 1}>count: {count}</button>\n<style>button{font:inherit;padding:.5rem 1rem}</style>`;

const times: number[] = [];
for (let i = 0; i < iterations; i++) {
  const t0 = performance.now();
  const res = await fetch(endpoint, { method: "POST", body: source });
  const json = await res.json() as any;
  const t1 = performance.now();
  if (!res.ok) throw new Error(JSON.stringify(json));
  times.push(t1 - t0);
  if (i === 0) console.log("first", { status: res.status, cache: json.cache, compileMs: json.compileMs, jsBytes: json.jsBytes });
}
times.sort((a, b) => a - b);
console.log({ endpoint, iterations, medianMs: +times[Math.floor(iterations / 2)].toFixed(2), p95Ms: +times[Math.floor(iterations * 0.95)].toFixed(2), minMs: +times[0].toFixed(2), maxMs: +times.at(-1)!.toFixed(2) });

export {};
