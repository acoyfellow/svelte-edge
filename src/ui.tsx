/** @jsxImportSource hono/jsx */
import { html } from "hono/html";
import type { FC } from "hono/jsx";
import { VERSION } from "svelte/compiler";

export const Shell: FC = () => {
  const sample = `<script>let count = 0;</script>\n<button onclick={() => count += 1}>count: {count}</button>\n<style>button{font:inherit;padding:.5rem 1rem;border-radius:.75rem;background:#ff3e00;color:white}</style>`;
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>svelte-edge playground</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="min-h-screen bg-zinc-950 text-zinc-100">
        <main class="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-4 md:p-8">
          <header class="flex flex-col gap-3 border-b border-zinc-800 pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p class="text-sm font-medium uppercase tracking-[0.3em] text-orange-400">Svelte on Workers</p>
              <h1 class="mt-2 text-4xl font-semibold tracking-tight md:text-6xl">svelte-edge</h1>
              <p class="mt-3 max-w-2xl text-zinc-400">Compile Svelte {VERSION} on a Cloudflare Worker. This is a tiny REPL/playground for the edge compiler experiment.</p>
            </div>
            <a class="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-orange-400 hover:text-orange-300" href="https://github.com/acoyfellow/svelte-edge">GitHub</a>
          </header>

          <section class="grid flex-1 gap-4 lg:grid-cols-2">
            <div class="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 shadow-2xl">
              <div class="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <h2 class="font-medium">Source</h2>
                <div class="flex gap-2">
                  <button id="compile-client" class="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-400">Compile client</button>
                  <button id="compile-server" class="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500">Compile server</button>
                </div>
              </div>
              <textarea id="source" spellCheck={false} class="flex-1 resize-none bg-zinc-950 p-4 font-mono text-sm leading-6 text-zinc-100 outline-none">{sample}</textarea>
            </div>

            <div class="grid gap-4">
              <section class="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70">
                <div class="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                  <h2 class="font-medium">Result</h2>
                  <span id="meta" class="text-xs text-zinc-500">idle</span>
                </div>
                <pre id="output" class="max-h-[360px] overflow-auto whitespace-pre-wrap p-4 text-xs leading-5 text-zinc-300">Click compile.</pre>
              </section>
              <section class="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70">
                <div class="border-b border-zinc-800 px-4 py-3"><h2 class="font-medium">CSS</h2></div>
                <pre id="css" class="max-h-[180px] overflow-auto whitespace-pre-wrap p-4 text-xs leading-5 text-zinc-300"></pre>
              </section>
              <section class="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-400">
                <p><span class="text-zinc-200">API:</span> POST <code class="text-orange-300">/compile?mode=client|server</code></p>
                <p class="mt-2"><span class="text-zinc-200">Note:</span> SSR render is documented as an experiment, but same-isolate eval is blocked by workerd string-code-generation restrictions.</p>
              </section>
            </div>
          </section>
        </main>
        <script>{html`
const source = document.getElementById('source');
const output = document.getElementById('output');
const css = document.getElementById('css');
const meta = document.getElementById('meta');
async function compile(mode) {
  meta.textContent = 'compiling ' + mode + '...';
  output.textContent = '';
  css.textContent = '';
  const t0 = performance.now();
  const res = await fetch('/compile?mode=' + mode, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: source.value });
  const json = await res.json();
  const ms = Math.round(performance.now() - t0);
  if (!res.ok) {
    meta.textContent = 'error · ' + ms + 'ms';
    output.textContent = JSON.stringify(json, null, 2);
    return;
  }
  meta.textContent = json.cache + ' · compile ' + json.compileMs + 'ms · roundtrip ' + ms + 'ms · ' + json.jsBytes + ' bytes';
  output.textContent = json.js || JSON.stringify(json, null, 2);
  css.textContent = json.css || '/* no css */';
}
document.getElementById('compile-client').onclick = () => compile('client');
document.getElementById('compile-server').onclick = () => compile('server');
        `}</script>
      </body>
    </html>
  );
};
