import { compile } from "svelte/compiler";
import { performance } from "node:perf_hooks";

const source = `<script>let count = 0;</script>
<button on:click={() => count += 1}>count: {count}</button>
<style>button{font:inherit;padding:.5rem 1rem}</style>`;

for (const generate of ["client", "server"] as const) {
  const t0 = performance.now();
  const result = compile(source, { generate, dev: false, name: "EdgeDemo" });
  const t1 = performance.now();
  console.log(JSON.stringify({ generate, ms: +(t1 - t0).toFixed(2), jsBytes: result.js.code.length, cssBytes: result.css?.code.length ?? 0 }, null, 2));
}
