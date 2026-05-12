import { compile } from "svelte/compiler";
import { gzipSync } from "node:zlib";
import { performance } from "node:perf_hooks";

const cases = {
  tiny: `<h1>Hello edge</h1>`,
  stateful: `<script>let count = 0;</script>\n<button on:click={() => count += 1}>count: {count}</button>\n<style>button{font:inherit;padding:.5rem 1rem}</style>`,
  list: `<script>export let items = Array.from({length: 50}, (_, i) => ({ id: i, name: \`item \${i}\` }));</script>\n<ul>{#each items as item (item.id)}<li>{item.name}</li>{/each}</ul>`,
  nestedish: `<script>let open = true; const rows = Array.from({length: 20}, (_, i) => i);</script>\n{#if open}<section>{#each rows as row}<article><h2>Row {row}</h2><p>{row % 2 ? 'odd' : 'even'}</p></article>{/each}</section>{/if}`
};

function measure(name: string, source: string, generate: "client" | "server") {
  const times: number[] = [];
  let js = "";
  let css = "";
  for (let i = 0; i < 25; i++) {
    const t0 = performance.now();
    const result = compile(source, { generate, dev: false, name: "EdgeComponent" });
    const t1 = performance.now();
    times.push(t1 - t0);
    js = result.js.code;
    css = result.css?.code ?? "";
  }
  times.sort((a, b) => a - b);
  return {
    name,
    generate,
    sourceBytes: Buffer.byteLength(source),
    medianMs: +times[Math.floor(times.length / 2)].toFixed(2),
    p95Ms: +times[Math.floor(times.length * 0.95)].toFixed(2),
    jsBytes: Buffer.byteLength(js),
    jsGzipBytes: gzipSync(js).byteLength,
    cssBytes: Buffer.byteLength(css)
  };
}

const rows = Object.entries(cases).flatMap(([name, source]) => [
  measure(name, source, "client"),
  measure(name, source, "server")
]);
console.table(rows);
console.log(JSON.stringify(rows, null, 2));
