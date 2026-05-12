/** @jsxImportSource hono/jsx */
import { html } from "hono/html";
import type { FC } from "hono/jsx";
import { VERSION } from "svelte/compiler";
import { styles } from "./styles.generated";

export const Shell: FC = () => {
  const sample = `<script>let count = 0;</script>\n<button onclick={() => count += 1}>count: {count}</button>\n<style>button{font:inherit;padding:.5rem 1rem;border-radius:.75rem;background:#ff3e00;color:white}</style>`;
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>svelte-edge playground</title>
        <style>{styles}</style>
      </head>
      <body class="min-h-screen bg-zinc-950 text-zinc-100">
        <main class="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-4 md:p-8">
          <header class="flex flex-col gap-3 border-b border-zinc-800 pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p class="text-sm font-medium uppercase tracking-[0.3em] text-orange-400">Svelte on Workers</p>
              <h1 class="mt-2 text-4xl font-semibold tracking-tight md:text-6xl">svelte-edge</h1>
              <p class="mt-3 max-w-2xl text-zinc-400">Compile Svelte {VERSION} on a Cloudflare Worker, then render the result in a sandboxed browser preview.</p>
            </div>
            <a class="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-orange-400 hover:text-orange-300" href="https://github.com/acoyfellow/svelte-edge">GitHub</a>
          </header>

          <section class="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div class="flex min-h-[640px] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 shadow-2xl">
              <div class="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <h2 class="font-medium">Source</h2>
                <div class="flex gap-2">
                  <button id="run-preview" class="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-400">Run preview</button>
                  <button id="compile-server" class="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500">Server JS</button>
                </div>
              </div>
              <textarea id="source" spellCheck={false} class="flex-1 resize-none bg-zinc-950 p-4 font-mono text-sm leading-6 text-zinc-100 outline-none">{sample}</textarea>
            </div>

            <div class="grid min-h-[640px] grid-rows-[auto_1fr_auto] gap-4">
              <section class="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70">
                <div class="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                  <div class="flex gap-2 text-sm">
                    <button data-tab="preview" class="tab rounded-md bg-zinc-800 px-3 py-1 text-zinc-100">Preview</button>
                    <button data-tab="js" class="tab rounded-md px-3 py-1 text-zinc-400 hover:text-zinc-100">JS</button>
                    <button data-tab="css" class="tab rounded-md px-3 py-1 text-zinc-400 hover:text-zinc-100">CSS</button>
                    <button data-tab="diagnostics" class="tab rounded-md px-3 py-1 text-zinc-400 hover:text-zinc-100">Diagnostics</button>
                  </div>
                  <span id="meta" class="text-xs text-zinc-500">idle</span>
                </div>
                <div id="panel-preview" class="panel h-[440px] bg-white">
                  <iframe id="preview" sandbox="allow-scripts allow-same-origin" class="h-full w-full bg-white"></iframe>
                </div>
                <pre id="panel-js" class="panel hidden h-[440px] overflow-auto whitespace-pre-wrap p-4 text-xs leading-5 text-zinc-300"></pre>
                <pre id="panel-css" class="panel hidden h-[440px] overflow-auto whitespace-pre-wrap p-4 text-xs leading-5 text-zinc-300"></pre>
                <pre id="panel-diagnostics" class="panel hidden h-[440px] overflow-auto whitespace-pre-wrap p-4 text-xs leading-5 text-zinc-300">Click Run preview.</pre>
              </section>

              <section class="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-400">
                <p><span class="text-zinc-200">How it works:</span> Worker compiles Svelte client JS. The browser preview uses an iframe, an import map for Svelte runtime modules, and a data module for the compiled component.</p>
                <p class="mt-2"><span class="text-zinc-200">API:</span> POST <code class="text-orange-300">/compile?mode=client|server</code></p>
              </section>
            </div>
          </section>
        </main>
        <script>{html`
const source = document.getElementById('source');
const meta = document.getElementById('meta');
const preview = document.getElementById('preview');
const panels = {
  preview: document.getElementById('panel-preview'),
  js: document.getElementById('panel-js'),
  css: document.getElementById('panel-css'),
  diagnostics: document.getElementById('panel-diagnostics')
};
const tabs = [...document.querySelectorAll('.tab')];
function show(tab) {
  for (const [name, el] of Object.entries(panels)) el.classList.toggle('hidden', name !== tab);
  for (const button of tabs) {
    const active = button.dataset.tab === tab;
    button.classList.toggle('bg-zinc-800', active);
    button.classList.toggle('text-zinc-100', active);
    button.classList.toggle('text-zinc-400', !active);
  }
}
async function compile(mode) {
  meta.textContent = 'compiling ' + mode + '...';
  const t0 = performance.now();
  const res = await fetch('/compile?mode=' + mode, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: source.value });
  const json = await res.json();
  const ms = Math.round(performance.now() - t0);
  panels.diagnostics.textContent = JSON.stringify(json, null, 2);
  if (!res.ok) {
    meta.textContent = 'error · ' + ms + 'ms';
    show('diagnostics');
    return null;
  }
  meta.textContent = json.cache + ' · compile ' + json.compileMs + 'ms · roundtrip ' + ms + 'ms · ' + json.jsBytes + ' bytes';
  panels.js.textContent = json.js || '';
  panels.css.textContent = json.css || '/* no css */';
  return json;
}
function previewDocument(moduleUrl, css) {
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<script type="importmap">' + JSON.stringify({ imports: { 'svelte/': 'https://esm.sh/svelte@${VERSION}/' } }) + '<' + '/script>' +
    '<style>body{font-family:ui-sans-serif,system-ui;margin:0;padding:2rem;color:#18181b} #app{display:contents}</style><style>' + css.replace(/<\\/style/gi, '<\\\\/style') + '</style></head>' +
    '<body><div id="app"></div><script type="module">import Component from ' + JSON.stringify(moduleUrl) + '; import { mount } from "svelte"; mount(Component, { target: document.getElementById("app") });<' + '/script></body></html>';
}
async function runPreview() {
  const json = await compile('client');
  if (!json) return;
  // Do not use blob: URLs here. A sandboxed srcdoc iframe has an opaque
  // origin in production browsers, so loading a parent-origin blob URL is
  // blocked as a local resource. Instead, inline the compiled module in a
  // data: URL. This keeps the preview self-contained inside the iframe.
  const moduleUrl = 'data:application/javascript;charset=utf-8,' + encodeURIComponent(json.js);
  preview.srcdoc = previewDocument(moduleUrl, json.css || '');
  show('preview');
}
document.getElementById('run-preview').onclick = runPreview;
document.getElementById('compile-server').onclick = async () => { await compile('server'); show('js'); };
for (const tab of tabs) tab.onclick = () => show(tab.dataset.tab);
runPreview();
        `}</script>
      </body>
    </html>
  );
};
