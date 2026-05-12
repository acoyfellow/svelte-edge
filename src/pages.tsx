/** @jsxImportSource hono/jsx */
import { renderToString } from "hono/jsx/dom/server";
import { EXAMPLES, getExample } from "./examples";
import { styles } from "./styles.generated";

function Page({ title, children }: { title: string; children: any }) {
  return renderToString(
    <html lang="en">
      <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>{title}</title><style>{styles}</style></head>
      <body><main class="doc-page"><nav><a href="/">Playground</a><a href="/examples">Examples</a><a href="/docs">Docs</a><a href="https://github.com/acoyfellow/svelte-edge">GitHub</a></nav>{children}</main></body>
    </html>
  );
}

export function examplesIndex() {
  return Page({ title: "svelte-edge examples", children: <><header><p class="system-label">EXAMPLES</p><h1>Copy a Svelte edge widget.</h1><p>Open an example in the playground, run it, then copy the artifact URLs.</p></header><section class="example-grid">{EXAMPLES.map((e) => <article class="example-card"><div><p class="system-label">{(e.tags ?? []).join(" · ")}</p><h2>{e.title}</h2><p>{e.summary}</p></div><div><a class="primary-link" href={`/?example=${e.slug}`}>Open in playground</a><a class="secondary-link" href={`/examples/${e.slug}`}>Details</a></div></article>)}</section></> });
}

export function exampleDetail(slug: string) {
  const example = getExample(slug);
  if (!example) return null;
  return Page({ title: `${example.title} · svelte-edge`, children: <><header><p class="system-label">EXAMPLE</p><h1>{example.title}</h1><p>{example.summary}</p><p><a class="primary-link" href={`/?example=${example.slug}`}>Open in playground</a></p></header><section class="doc-card"><h2>Source</h2><pre>{example.source}</pre></section><section class="doc-card"><h2>How it works</h2><ol><li>The source is sent to <code>POST /artifacts</code>.</li><li>The Worker compiles client and server artifacts with Svelte {"5"}.</li><li>The playground mounts the client artifact in a sandboxed iframe.</li><li>The Artifacts tab exposes URLs for JS, CSS, preview HTML, and metadata.</li></ol></section></> });
}

export function docsIndex() {
  return Page({ title: "svelte-edge docs", children: <><header><p class="system-label">DOCS</p><h1>Use Svelte edge artifacts.</h1><p>Docs follow Diátaxis: tutorials, how-to guides, reference, and explanation.</p></header><section class="example-grid"><a class="example-card" href="/docs/tutorials/first-edge-widget"><h2>Tutorial</h2><p>Create your first edge widget.</p></a><a class="example-card" href="/docs/reference/api"><h2>Reference</h2><p>API endpoints and manifest shape.</p></a><a class="example-card" href="/docs/explanation/artifacts-not-repl"><h2>Explanation</h2><p>Why this is not trying to replace the Svelte Playground.</p></a></section></> });
}

export function docPage(path: string) {
  if (path === "/docs/tutorials/first-edge-widget") return Page({ title: "Create your first edge widget", children: <><header><p class="system-label">TUTORIAL</p><h1>Create your first edge widget.</h1></header><section class="doc-card"><ol><li>Open the playground.</li><li>Paste a Svelte component.</li><li>Click <strong>Run</strong>.</li><li>Open the <strong>Artifacts</strong> tab.</li><li>Copy <code>preview.html</code> for an iframe embed, or <code>client.js</code> for a module import.</li></ol></section></> });
  if (path === "/docs/reference/api") return Page({ title: "API reference", children: <><header><p class="system-label">REFERENCE</p><h1>API reference.</h1></header><section class="doc-card"><pre>{`POST /compile?mode=client|server
POST /artifacts
GET /artifacts/:hash/client.js
GET /artifacts/:hash/server.js
GET /artifacts/:hash/style.css
GET /artifacts/:hash/preview.html
GET /artifacts/:hash/manifest.json`}</pre></section></> });
  if (path === "/docs/explanation/artifacts-not-repl") return Page({ title: "Artifacts, not a REPL", children: <><header><p class="system-label">EXPLANATION</p><h1>Artifacts, not another REPL.</h1></header><section class="doc-card"><p>The Svelte Playground shows what your component does. svelte-edge shows what Cloudflare can turn it into: client JS, server JS, CSS, preview HTML, and a manifest that can be cached and addressed at the edge.</p><p>The playground is the inspection UI. The product idea is the artifact pipeline.</p></section></> });
  return null;
}
