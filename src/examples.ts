// Curated Svelte 5 component examples that ship with the playground.
// Each entry is addressable by slug at /examples/:slug and can be
// loaded into the playground via /?example=slug.

export type Example = {
  slug: string;
  title: string;
  summary: string;
  source: string;
  tags?: string[];
};

const counter: Example = {
  slug: "counter",
  title: "Counter",
  summary: "A reactive counter using Svelte 5 runes.",
  tags: ["runes", "state"],
  source: `<script>
  let count = $state(0);
</script>

<button onclick={() => count += 1}>count: {count}</button>

<style>
  button { font: 700 16px system-ui; padding: 12px 18px; border: 0; border-radius: 12px; background: #ff5a1f; color: white; }
</style>`
};

const greet: Example = {
  slug: "greet",
  title: "Hello, props",
  summary: "Props with $props(). Good for static/SSR-style bundles.",
  tags: ["props", "ssr"],
  source: `<script>
  let { name = "edge" } = $props();
</script>

<h1>Hello, {name}!</h1>

<style>
  h1 { font: 800 2.25rem/1 ui-sans-serif, system-ui; color: #18181b; margin: 0; }
</style>`
};

const pricing: Example = {
  slug: "pricing-calculator",
  title: "Pricing calculator",
  summary: "A tiny embeddable calculator with $state and $derived.",
  tags: ["runes", "calculator"],
  source: `<script>
  let seats = $state(10);
  let plan = $state(29);
  let monthly = $derived(seats * plan);
  let annual = $derived(monthly * 12 * 0.8);
</script>

<section>
  <h2>Pricing calculator</h2>
  <label>Seats <input type="range" min="1" max="100" bind:value={seats}> <strong>{seats}</strong></label>
  <label>Plan <select bind:value={plan}><option value={29}>Starter — $29</option><option value={79}>Pro — $79</option><option value={199}>Business — $199</option></select></label>
  <div class="total"><span>Annual estimate</span><strong>{annual.toLocaleString()}</strong></div>
</section>

<style>
  section{font:16px system-ui;padding:24px;max-width:420px;border-radius:24px;background:linear-gradient(#fff,#fff8f3);border:1px solid #f1d4c4}
  label{display:grid;gap:8px;margin:16px 0}.total{display:flex;justify-content:space-between;align-items:baseline;margin-top:20px;padding-top:20px;border-top:1px solid #eee}.total strong{font-size:32px}
</style>`
};

const agentReview: Example = {
  slug: "agent-review-ui",
  title: "Agent review UI",
  summary: "An agent-generated approval form that posts structured data back to the host page.",
  tags: ["agents", "postMessage"],
  source: `<script>
  let records = $state([
    { id: 'old', name: 'old.example.com', type: 'A', value: '192.0.2.1', selected: true },
    { id: 'test', name: 'test.example.com', type: 'CNAME', value: 'workers.dev', selected: true },
    { id: 'stage', name: 'staging.example.com', type: 'A', value: '192.0.2.2', selected: false }
  ]);
  let selected = $derived(records.filter((record) => record.selected));

  function submit() {
    parent.postMessage({
      type: 'svelte-edge:submit',
      value: { selectedRecords: selected.map((record) => record.id) }
    }, '*');
  }
</script>

<section>
  <h2>Review DNS cleanup</h2>
  <p>{selected.length} records selected</p>
  {#each records as record}
    <label class="row">
      <input type="checkbox" bind:checked={record.selected} />
      <span><strong>{record.name}</strong><small>{record.type} → {record.value}</small></span>
    </label>
  {/each}
  <button disabled={selected.length === 0} onclick={submit}>Continue with {selected.length} records</button>
</section>

<style>
  section{font:15px system-ui;max-width:560px;padding:24px;border-radius:24px;background:#fff;border:1px solid #e5e0d8}.row{display:flex;gap:12px;align-items:center;padding:12px 0;border-top:1px solid #eee}small{display:block;color:#777}button{margin-top:18px;width:100%;border:0;border-radius:14px;padding:12px;background:#ff5a1f;color:white;font-weight:800}button:disabled{background:#ddd}
</style>`
};

const clock: Example = {
  slug: "clock",
  title: "Effect clock",
  summary: "Use $effect for side effects and cleanup.",
  tags: ["effect", "lifecycle"],
  source: `<script>
  let now = $state(new Date());
  $effect(() => {
    const id = setInterval(() => { now = new Date(); }, 1000);
    return () => clearInterval(id);
  });
</script>

<p>{now.toLocaleTimeString()}</p>

<style>p{font:700 1.5rem/1 ui-monospace,monospace;color:#18181b}</style>`
};

const card: Example = {
  slug: "card",
  title: "Stateless card",
  summary: "A presentational component with $props().",
  tags: ["props", "static"],
  source: `<script>
  let { title = "edge bundles", body = "Compile once. Cache by hash. Serve as URLs." } = $props();
</script>

<article><h2>{title}</h2><p>{body}</p></article>

<style>
  article{border:1px solid #e6e3dc;border-radius:1rem;padding:1.4rem 1.6rem;background:linear-gradient(180deg,#fff,#fffaf3);font:500 1rem/1.55 ui-sans-serif,system-ui;color:#1d1b18;max-width:36rem}h2{margin:0 0 .5rem;font-size:1.2rem;font-weight:760}p{margin:0;color:#4a463e}
</style>`
};

export const EXAMPLES: Example[] = [counter, agentReview, pricing, greet, clock, card];

export function getExample(slug: string): Example | undefined {
  return EXAMPLES.find((e) => e.slug === slug);
}
