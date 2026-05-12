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
      <body class="min-h-screen">
        <main class="mx-auto max-w-6xl p-4 md:p-8">
          <header class="simple-hero">
            <div>
              <p class="system-label">SVELTE EDGE</p>
              <h1>Compile Svelte on the edge.</h1>
              <p>Type a component. Cloudflare Workers compile it. The browser renders it. The result becomes addressable edge artifacts.</p>
            </div>
            <a class="github-icon" href="https://github.com/acoyfellow/svelte-edge" aria-label="GitHub"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.23 1.92 1.23 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z"/></svg></a>
          </header>

          <section class="playground-card mt-6">
            <div class="card-head">
              <div><p class="system-label">SOURCE</p><h2>Svelte component</h2></div>
              <div class="actions"><button id="run-preview" class="primary-button">Run</button><button id="compile-server" class="secondary-button">Server JS</button></div>
            </div>
            <textarea id="source" spellCheck={false} class="source-editor" rows={4}>{sample}</textarea>
          </section>

          <section class="playground-card mt-4 overflow-hidden">
            <div class="card-head">
              <div><p class="system-label">RESULT</p><h2 id="status-readout">Preview</h2></div>
              <div class="result-meta"><span id="compile-readout">Svelte {VERSION}</span><span id="roundtrip-readout">idle</span><span id="payload-readout">—</span></div>
            </div>
            <div class="tabs"><button data-tab="preview" class="tab active-tab">Preview</button><button data-tab="artifacts" class="tab">Artifacts</button><button data-tab="js" class="tab">Client JS</button><button data-tab="css" class="tab">CSS</button><button data-tab="diagnostics" class="tab">Trace</button></div>
            <div id="panel-preview" class="panel preview-well"><iframe id="preview" sandbox="allow-scripts" class="h-full w-full bg-white"></iframe></div>
            <div id="panel-artifacts" class="panel artifacts-panel hidden"><div id="artifact-list" class="artifact-list">Run the component to create artifact URLs.</div></div>
            <pre id="panel-js" class="panel code-panel hidden"></pre>
            <pre id="panel-css" class="panel code-panel hidden"></pre>
            <pre id="panel-diagnostics" class="panel code-panel hidden">Run the component to see compiler output.</pre>
          </section>
        </main>
        <script>{html`
const source = document.getElementById('source');
const preview = document.getElementById('preview');
const panels = { preview: document.getElementById('panel-preview'), artifacts: document.getElementById('panel-artifacts'), js: document.getElementById('panel-js'), css: document.getElementById('panel-css'), diagnostics: document.getElementById('panel-diagnostics') };
const artifactList = document.getElementById('artifact-list');
const tabs = [...document.querySelectorAll('.tab')];
const statusReadout = document.getElementById('status-readout');
const compileReadout = document.getElementById('compile-readout');
const roundtripReadout = document.getElementById('roundtrip-readout');
const payloadReadout = document.getElementById('payload-readout');
function autoResize() { source.style.height = 'auto'; source.style.height = Math.max(132, source.scrollHeight) + 'px'; }
source.addEventListener('input', autoResize);
function show(tab) { for (const [name, el] of Object.entries(panels)) el.classList.toggle('hidden', name !== tab); for (const button of tabs) button.classList.toggle('active-tab', button.dataset.tab === tab); }
function artifactRow(name, url, detail) { return '<div class="artifact-row"><div><strong>'+name+'</strong><span>'+detail+'</span></div><div class="artifact-actions"><button data-copy="'+url+'">Copy</button><a href="'+url+'" target="_blank" rel="noreferrer">Open</a></div></div>'; }
function renderArtifacts(data) {
  const a = data.artifacts;
  artifactList.innerHTML = '<div class="artifact-summary"><strong>Artifact '+data.id+'</strong><span>'+data.sourceHash+'</span></div>' +
    artifactRow('client.js', a.client, data.sizes.clientJs + ' bytes · ' + data.cache.client) +
    artifactRow('server.js', a.server, data.sizes.serverJs + ' bytes · ' + data.cache.server) +
    artifactRow('style.css', a.css, data.sizes.css + ' bytes') +
    artifactRow('preview.html', a.preview, 'openable preview document') +
    artifactRow('manifest.json', a.manifest, 'artifact metadata');
  artifactList.querySelectorAll('[data-copy]').forEach(btn => btn.onclick = async () => { await navigator.clipboard.writeText(btn.dataset.copy); btn.textContent = 'Copied'; setTimeout(() => btn.textContent = 'Copy', 900); });
}
async function createArtifacts() {
  const t0 = performance.now();
  const res = await fetch('/artifacts', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: source.value });
  const data = await res.json();
  const ms = Math.round(performance.now() - t0);
  panels.diagnostics.textContent = JSON.stringify(data, null, 2);
  if (!res.ok) { statusReadout.textContent = 'Compile failed'; show('diagnostics'); return null; }
  statusReadout.textContent = 'Preview live';
  compileReadout.textContent = 'client ' + data.timings.clientCompileMs + 'ms · server ' + data.timings.serverCompileMs + 'ms';
  roundtripReadout.textContent = ms + 'ms roundtrip';
  payloadReadout.textContent = data.sizes.clientJs + ' bytes';
  panels.js.textContent = data.client.js || '';
  panels.css.textContent = data.client.css || '/* no css */';
  renderArtifacts(data);
  return data;
}
function previewDocument(moduleUrl, css) { return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + '<script type="importmap">' + JSON.stringify({ imports: { 'svelte': 'https://esm.sh/svelte@${VERSION}', 'svelte/': 'https://esm.sh/svelte@${VERSION}/' } }) + '<' + '/script>' + '<style>body{font-family:Inter,ui-sans-serif,system-ui;margin:0;padding:2rem;color:#18181b} #app{display:contents}</style><style>' + css.replace(/<\\/style/gi, '<\\\\/style') + '</style></head>' + '<body><div id="app"></div><script type="module">import Component from ' + JSON.stringify(moduleUrl) + '; import { mount } from "svelte"; mount(Component, { target: document.getElementById("app") });<' + '/script></body></html>'; }
async function runPreview() { const data = await createArtifacts(); if (!data) return; const moduleUrl = 'data:application/javascript;charset=utf-8,' + encodeURIComponent(data.client.js); preview.srcdoc = previewDocument(moduleUrl, data.client.css || ''); show('preview'); }
document.getElementById('run-preview').onclick = runPreview;
document.getElementById('compile-server').onclick = async () => { const data = await createArtifacts(); if (data) { panels.js.textContent = data.server.js || ''; show('js'); } };
for (const tab of tabs) tab.onclick = () => show(tab.dataset.tab);
autoResize(); runPreview();
        `}</script>
      </body>
    </html>
  );
};
