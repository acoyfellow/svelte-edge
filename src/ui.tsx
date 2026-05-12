/** @jsxImportSource hono/jsx */
import { html } from "hono/html";
import type { FC } from "hono/jsx";
import { VERSION } from "svelte/compiler";
import { styles } from "./styles.generated";
import { EXAMPLES, type Example } from "./examples";

const DEFAULT_SAMPLE = `<script>let count = 0;</script>\n<button onclick={() => count += 1}>count: {count}</button>\n<style>button{font:inherit;padding:.5rem 1rem;border-radius:.75rem;background:#ff3e00;color:white}</style>`;

type ShellProps = { initialSource?: string; activeExample?: string };

const NAV_ITEMS = [
  { href: "/", label: "Playground" },
  { href: "/examples", label: "Examples" },
  { href: "/docs", label: "Docs" },
  { href: "/docs/tutorial-first-edge-widget", label: "First widget" },
  { href: "/docs/reference-api", label: "API reference" },
  { href: "/docs/explanation-artifacts-not-repl", label: "Why artifacts" }
];

const TopNav: FC<{ active?: "playground" | "examples" | "docs" }> = ({ active }) => (
  <nav class="top-nav">
    <a href="/" class={active === "playground" ? "nav-link active" : "nav-link"}>Playground</a>
    <a href="/examples" class={active === "examples" ? "nav-link active" : "nav-link"}>Examples</a>
    <a href="/docs" class={active === "docs" ? "nav-link active" : "nav-link"}>Docs</a>
  </nav>
);

const Sidebar: FC<{ current?: string }> = ({ current }) => (
  <aside class="sidebar">
    <a class="brand" href="/">svelte-edge</a>
    <nav>
      <p>Start</p>
      {NAV_ITEMS.slice(0, 3).map((item) => <a class={current === item.href ? "active" : ""} href={item.href}>{item.label}</a>)}
      <p>Docs</p>
      {NAV_ITEMS.slice(3).map((item) => <a class={current === item.href ? "active" : ""} href={item.href}>{item.label}</a>)}
    </nav>
  </aside>
);

const MobileNav: FC<{ current?: string }> = ({ current }) => (
  <details class="mobile-nav">
    <summary>Menu</summary>
    <div>{NAV_ITEMS.map((item) => <a class={current === item.href ? "active" : ""} href={item.href}>{item.label}</a>)}</div>
  </details>
);

export const Shell: FC<ShellProps> = ({ initialSource, activeExample }) => {
  const sample = initialSource ?? DEFAULT_SAMPLE;
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>svelte-edge playground</title>
        <style>{styles}</style>
      </head>
      <body class="min-h-screen">
        <Sidebar current="/" />
        <MobileNav current="/" />
        <main class="layout-main">
          <header class="simple-hero">
            <div>
              <p class="system-label">SVELTE EDGE</p>
              <h1>Compile Svelte on the edge.</h1>
              <p>Type a component. Cloudflare Workers compile it. The browser renders it. The result becomes addressable edge artifacts.</p>
              <TopNav active="playground" />
              {activeExample ? <p class="example-tag">example: <code>{activeExample}</code></p> : null}
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

const PageChrome: FC<{ title: string; active: "playground" | "examples" | "docs"; current: string; children?: unknown; prev?: { href: string; label: string }; next?: { href: string; label: string } }> = ({ title, active, current, children, prev, next }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title} · svelte-edge</title>
      <style>{styles}</style>
    </head>
    <body class="min-h-screen">
      <Sidebar current={current} />
      <MobileNav current={current} />
      <main class="layout-main">
        <header class="simple-hero">
          <div>
            <p class="system-label">SVELTE EDGE</p>
            <h1>{title}</h1>
            <TopNav active={active} />
          </div>
          <a class="github-icon" href="https://github.com/acoyfellow/svelte-edge" aria-label="GitHub"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.23 1.92 1.23 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z"/></svg></a>
        </header>
        {children}
        {(prev || next) ? <nav class="page-flow">{prev ? <a href={prev.href}>← {prev.label}</a> : <span></span>}{next ? <a href={next.href}>{next.label} →</a> : <span></span>}</nav> : null}
      </main>
    </body>
  </html>
);

export const ExamplesIndex: FC<{ examples: Example[] }> = ({ examples }) => (
  <PageChrome title="Examples" active="examples" current="/examples" next={{ href: "/docs", label: "Docs" }}>
    <section class="playground-card mt-6">
      <div class="card-head">
        <div><p class="system-label">GALLERY</p><h2>Svelte components, ready to compile</h2></div>
      </div>
      <ul class="example-grid">
        {examples.map((e) => (
          <li class="example-tile">
            <p class="system-label">{(e.tags ?? []).join(" · ") || "example"}</p>
            <h3>{e.title}</h3>
            <p class="muted">{e.summary}</p>
            <div class="example-actions">
              <a class="primary-button" href={`/examples/${e.slug}`}>Open</a>
              <a class="secondary-button" href={`/?example=${e.slug}`}>Load in playground</a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  </PageChrome>
);

export const ExampleDetail: FC<{ example: Example }> = ({ example }) => (
  <PageChrome title={example.title} active="examples" current={`/examples/${example.slug}`} prev={{ href: "/examples", label: "Examples" }} next={{ href: "/docs", label: "Docs" }}>
    <section class="playground-card mt-6">
      <div class="card-head">
        <div>
          <p class="system-label">{(example.tags ?? []).join(" · ") || "example"}</p>
          <h2>{example.title}</h2>
        </div>
        <div class="actions">
          <a class="primary-button" href={`/?example=${example.slug}`}>Load in playground</a>
          <a class="secondary-button" href="/examples">All examples</a>
        </div>
      </div>
      <div class="example-detail-body">
        <p>{example.summary}</p>
        <pre class="code-panel">{example.source}</pre>
      </div>
    </section>
  </PageChrome>
);

export const NotFoundPage: FC<{ message: string }> = ({ message }) => (
  <PageChrome title="Not found" active="examples" current="/examples">
    <section class="playground-card mt-6">
      <div class="card-head"><div><p class="system-label">404</p><h2>{message}</h2></div></div>
      <div class="example-detail-body">
        <p>Try the <a href="/examples">examples gallery</a> or the <a href="/">playground</a>.</p>
      </div>
    </section>
  </PageChrome>
);

type DocPage = { slug: string; kind: "tutorial" | "reference" | "explanation" | "how-to"; title: string; summary: string };

export const DOC_PAGES: DocPage[] = [
  { slug: "tutorial-first-edge-widget", kind: "tutorial", title: "Your first edge widget", summary: "Walk through compiling, previewing and rendering a Svelte component from scratch." },
  { slug: "reference-api", kind: "reference", title: "HTTP API reference", summary: "All routes: /compile, /artifacts, /render, /health." },
  { slug: "explanation-artifacts-not-repl", kind: "explanation", title: "Artifacts, not a REPL", summary: "Why we hash sources to URLs instead of streaming a session-bound REPL." }
];

export const DocsIndex: FC = () => (
  <PageChrome title="Docs" active="docs" current="/docs" prev={{ href: "/examples", label: "Examples" }} next={{ href: "/docs/tutorial-first-edge-widget", label: "First widget" }}>
    <section class="playground-card mt-6">
      <div class="card-head">
        <div><p class="system-label">GUIDES</p><h2>Learn by doing, then look up details when you need them.</h2></div>
      </div>
      <ul class="doc-grid">
        {DOC_PAGES.map((d) => (
          <li class="doc-tile">
            <p class="system-label">{d.kind}</p>
            <h3><a href={`/docs/${d.slug}`}>{d.title}</a></h3>
            <p class="muted">{d.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  </PageChrome>
);

const TutorialPage: FC = () => (
  <article class="doc-body">
    <p class="system-label">GET STARTED</p>
    <h2>Your first edge widget</h2>
    <p class="lead">Build a tiny Svelte component, compile it on a Worker, preview it in the browser, and copy the generated artifact URLs.</p>

    <div class="callout"><strong>You will make:</strong><ul><li>a live preview</li><li>a <code>client.js</code> module</li><li>a <code>style.css</code> file</li><li>a <code>manifest.json</code> with timings and sizes</li></ul></div>

    <h3>1. Start local dev</h3>
    <pre class="code-panel">cd svelte-edge
npm install
npm run dev</pre>
    <p>Open the local URL Wrangler prints. The playground starts with a counter component.</p>

    <h3>2. Paste a component</h3>
    <p>Try this component. It has state, markup, and scoped CSS in one file:</p>
    <pre class="code-panel">{`<script>
  let count = 0;
</script>

<button onclick={() => count += 1}>
  count: {count}
</button>

<style>
  button {
    font: 700 16px system-ui;
    padding: 12px 18px;
    border: 0;
    border-radius: 12px;
    background: #ff5a1f;
    color: white;
  }
</style>`}</pre>

    <h3>3. Click Run</h3>
    <p>The browser sends your Svelte source to <code>POST /artifacts</code>. The Worker compiles both client and server output and returns a manifest.</p>
    <ul><li><strong>Preview</strong> mounts the client artifact in a sandboxed iframe.</li><li><strong>Artifacts</strong> shows URLs for generated files.</li><li><strong>Trace</strong> shows the full JSON response.</li></ul>

    <h3>4. Use the output</h3>
    <p>For an iframe embed, copy <code>preview.html</code> from the Artifacts tab:</p>
    <pre class="code-panel">{`<iframe
  src="https://svelte-edge.coy.workers.dev/artifacts/<hash>/preview.html"
  style="border:0;width:100%;height:240px"
></iframe>`}</pre>
    <p>For a module import, use <code>client.js</code> and Svelte's runtime mount API:</p>
    <pre class="code-panel">{`<div id="widget"></div>
<script type="importmap">
{
  "imports": {
    "svelte": "https://esm.sh/svelte@5.55.5",
    "svelte/": "https://esm.sh/svelte@5.55.5/"
  }
}
</script>
<script type="module">
  import Widget from "https://svelte-edge.coy.workers.dev/artifacts/<hash>/client.js";
  import { mount } from "svelte";
  mount(Widget, { target: document.getElementById("widget") });
</script>`}</pre>
  </article>
);

const ReferencePage: FC = () => (
  <article class="doc-body">
    <p class="system-label">API</p>
    <h2>HTTP API reference</h2>
    <p class="lead">The API is intentionally small: compile source, create artifacts, and read artifacts back by hash.</p>

    <h3>Limits</h3>
    <ul><li>Source body: <code>256 KiB</code></li><li>Props query for SSR: <code>32 KiB</code></li><li>Svelte compiler: <code>5.55.5</code></li><li>Artifact URL persistence requires <code>SVELTE_EDGE_CACHE</code></li></ul>

    <h3>POST /artifacts</h3>
    <p>Use this when you want a preview plus addressable outputs.</p>
    <pre class="code-panel">{`curl -sX POST https://svelte-edge.coy.workers.dev/artifacts \\
  -H "content-type: text/plain" \\
  --data '<h1>Hello edge</h1>'`}</pre>
    <p>Response shape:</p>
    <pre class="code-panel">{`{
  "id": "a0d436a1c36e",
  "sourceHash": "a0d436...",
  "svelte": "5.55.5",
  "cache": { "client": "miss", "server": "miss" },
  "artifacts": {
    "client": ".../client.js",
    "server": ".../server.js",
    "css": ".../style.css",
    "preview": ".../preview.html",
    "manifest": ".../manifest.json"
  },
  "sizes": { "clientJs": 281, "serverJs": 150, "css": 0 },
  "timings": { "clientCompileMs": 0, "serverCompileMs": 0 }
}`}</pre>

    <h3>POST /compile?mode=client|server</h3>
    <p>Use this when you only need one compile output.</p>
    <pre class="code-panel">{`curl -sX POST 'https://svelte-edge.coy.workers.dev/compile?mode=client' \\
  -H "content-type: text/plain" \\
  --data '<button>hello</button>'`}</pre>

    <h3>GET /artifacts/&lt;hash&gt;/&lt;file&gt;</h3>
    <p>Read a generated artifact. Valid files:</p>
    <ul><li><code>client.js</code> — browser component module</li><li><code>server.js</code> — SSR compiler output</li><li><code>style.css</code> — scoped CSS</li><li><code>preview.html</code> — standalone iframe document</li><li><code>manifest.json</code> — metadata</li></ul>

    <h3>POST /render</h3>
    <p>Experimental SSR path. Useful for testing server output, but not the main embed path.</p>
    <pre class="code-panel">{`curl -sX POST 'https://svelte-edge.coy.workers.dev/render?format=html' \\
  -H "content-type: text/plain" \\
  --data '<h1>Hello SSR</h1>'`}</pre>
  </article>
);

const ExplanationPage: FC = () => (
  <article class="doc-body">
    <p class="system-label">WHY</p>
    <h2>Artifacts, not a REPL</h2>
    <p class="lead">The Svelte Playground is for learning and experimenting. svelte-edge is for giving agents and apps a way to turn Svelte source into URLs they can use immediately.</p>

    <h3>The useful primitive</h3>
    <pre class="code-panel">{`Svelte source
  → Cloudflare Worker compiler
  → client.js + server.js + style.css + preview.html + manifest.json
  → share, embed, cache, or hand to an agent`}</pre>

    <h3>Why this matters for agents</h3>
    <p>A small browser model like <code>window.ai</code> can write Svelte on demand, call <code>/artifacts</code>, and return an inline UI instead of a wall of text.</p>
    <ul><li>Need a calculator? The agent generates a live calculator.</li><li>Need a review screen? The agent generates checkboxes and a submit button.</li><li>Need to explain data? The agent generates a tiny dashboard.</li></ul>

    <h3>Minimal agent flow</h3>
    <pre class="code-panel">{`const source = await window.ai.prompt(
  "Write a Svelte component for a pricing calculator. Return only .svelte source."
);

const artifact = await fetch("https://svelte-edge.coy.workers.dev/artifacts", {
  method: "POST",
  headers: { "content-type": "text/plain" },
  body: source
}).then(r => r.json());

chat.render({
  type: "iframe",
  src: artifact.artifacts.preview
});`}</pre>

    <h3>Two-way generated UI</h3>
    <p>The next step is a convention for agent-generated components to send structured results back to the host app:</p>
    <pre class="code-panel">{`<script>
  let region = 'wnam';
  let plan = 'paid';

  function submit() {
    parent.postMessage({
      type: 'svelte-edge:submit',
      value: { region, plan }
    }, '*');
  }
</script>

<button onclick={submit}>Use these settings</button>`}</pre>

    <h3>What makes this different</h3>
    <p>The output is not tied to a playground session. It is an artifact graph with stable names and a manifest. That makes it easier to embed in chat, docs, dashboards, CMS previews, or future Dynamic Worker deploys.</p>
  </article>
);

const docComponents: Record<string, FC> = {
  "tutorial-first-edge-widget": TutorialPage,
  "reference-api": ReferencePage,
  "explanation-artifacts-not-repl": ExplanationPage
};

function prevDoc(slug: string) {
  const order = ["tutorial-first-edge-widget", "reference-api", "explanation-artifacts-not-repl"];
  const labels: Record<string, string> = { "tutorial-first-edge-widget": "First widget", "reference-api": "API reference", "explanation-artifacts-not-repl": "Why artifacts" };
  const i = order.indexOf(slug);
  if (i <= 0) return { href: "/docs", label: "Docs" };
  return { href: `/docs/${order[i - 1]}`, label: labels[order[i - 1]] };
}
function nextDoc(slug: string) {
  const order = ["tutorial-first-edge-widget", "reference-api", "explanation-artifacts-not-repl"];
  const labels: Record<string, string> = { "tutorial-first-edge-widget": "First widget", "reference-api": "API reference", "explanation-artifacts-not-repl": "Why artifacts" };
  const i = order.indexOf(slug);
  if (i === -1 || i >= order.length - 1) return undefined;
  return { href: `/docs/${order[i + 1]}`, label: labels[order[i + 1]] };
}

export const DocPageView: FC<{ slug: string }> = ({ slug }) => {
  const meta = DOC_PAGES.find((d) => d.slug === slug);
  const Body = docComponents[slug];
  if (!meta || !Body) {
    return <NotFoundPage message={`No doc with slug "${slug}"`} />;
  }
  return (
    <PageChrome title={meta.title} active="docs" current={`/docs/${slug}`} prev={prevDoc(slug)} next={nextDoc(slug)}>
      <section class="playground-card mt-6">
        <div class="card-head">
          <div><p class="system-label">{meta.kind.toUpperCase()}</p><h2>{meta.title}</h2></div>
          <div class="actions"><a class="secondary-button" href="/docs">All docs</a></div>
        </div>
        <div class="doc-wrap"><Body /></div>
      </section>
    </PageChrome>
  );
};
