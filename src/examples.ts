// Curated Svelte component examples that ship with the playground.
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
  summary: "A reactive counter using Svelte 5 runes. Click the button; state updates without ceremony.",
  tags: ["runes", "state"],
  source: `<script>
  let count = $state(0);
</script>

<button onclick={() => count += 1}>count: {count}</button>

<style>
  button {
    font: inherit;
    padding: .55rem 1rem;
    border-radius: .75rem;
    border: 0;
    background: #ff3e00;
    color: white;
    cursor: pointer;
  }
  button:hover { filter: brightness(1.06); }
</style>
`
};

const greet: Example = {
  slug: "greet",
  title: "Hello, props",
  summary: "Props with $props(). Renders deterministically with /render for SSR — no client JS required.",
  tags: ["props", "ssr"],
  source: `<script>
  let { name = "edge" } = $props();
</script>

<h1>Hello, {name}!</h1>

<style>
  h1 {
    font: 700 2rem/1.1 ui-sans-serif, system-ui;
    color: #18181b;
    margin: 0;
  }
</style>
`
};

const derived: Example = {
  slug: "derived",
  title: "Derived state",
  summary: "Compute values with $derived; updates flow automatically when inputs change.",
  tags: ["runes", "derived"],
  source: `<script>
  let count = $state(1);
  let doubled = $derived(count * 2);
</script>

<div class="row">
  <button onclick={() => count += 1}>increment</button>
  <p>count: {count} · doubled: {doubled}</p>
</div>

<style>
  .row { display: flex; align-items: center; gap: 1rem; font: 500 1rem/1.4 ui-sans-serif, system-ui; }
  button { font: inherit; padding: .4rem .8rem; border-radius: .55rem; border: 1px solid #ddd; background: #fff; cursor: pointer; }
</style>
`
};

const effectClock: Example = {
  slug: "clock",
  title: "Effect clock",
  summary: "Use $effect for side effects — set up an interval on mount, tear it down on cleanup.",
  tags: ["effect", "lifecycle"],
  source: `<script>
  let now = $state(new Date());
  $effect(() => {
    const id = setInterval(() => { now = new Date(); }, 1000);
    return () => clearInterval(id);
  });
</script>

<p>{now.toLocaleTimeString()}</p>

<style>
  p { font: 600 1.4rem/1 ui-monospace, SFMono-Regular, Menlo, monospace; color: #18181b; }
</style>
`
};

const todo: Example = {
  slug: "todo",
  title: "Todo list",
  summary: "Lists, bindings and conditional rendering. Demonstrates idiomatic Svelte 5 with mutating arrays.",
  tags: ["lists", "bindings"],
  source: `<script>
  let items = $state([
    { id: 1, text: "compile at the edge", done: true },
    { id: 2, text: "render somewhere useful", done: false }
  ]);
  let draft = $state("");

  function add() {
    const text = draft.trim();
    if (!text) return;
    items = [...items, { id: Date.now(), text, done: false }];
    draft = "";
  }
</script>

<form onsubmit={(e) => { e.preventDefault(); add(); }}>
  <input bind:value={draft} placeholder="next thing to ship" />
  <button type="submit">add</button>
</form>

<ul>
  {#each items as item (item.id)}
    <li class:done={item.done}>
      <label>
        <input type="checkbox" bind:checked={item.done} />
        {item.text}
      </label>
    </li>
  {/each}
</ul>

<style>
  form { display: flex; gap: .5rem; margin: 0 0 1rem; }
  input[type=text], input:not([type]) { flex: 1; padding: .45rem .7rem; border-radius: .55rem; border: 1px solid #ddd; font: inherit; }
  button { padding: .45rem .9rem; border-radius: .55rem; border: 0; background: #ff3e00; color: white; cursor: pointer; }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: .25rem; font: 500 .95rem/1.4 ui-sans-serif, system-ui; }
  li.done label { text-decoration: line-through; color: #888; }
  label { display: flex; gap: .55rem; align-items: center; }
</style>
`
};

const card: Example = {
  slug: "card",
  title: "Stateless card",
  summary: "A purely presentational component — perfect for SSR. No runtime needed in the browser.",
  tags: ["ssr", "static"],
  source: `<script>
  let { title = "edge artifacts", body = "Compile once. Cache by hash. Serve as URLs." } = $props();
</script>

<article>
  <h2>{title}</h2>
  <p>{body}</p>
</article>

<style>
  article {
    border: 1px solid #e6e3dc;
    border-radius: 1rem;
    padding: 1.4rem 1.6rem;
    background: linear-gradient(180deg,#fff,#fffaf3);
    font: 500 1rem/1.55 ui-sans-serif, system-ui;
    color: #1d1b18;
    max-width: 36rem;
  }
  h2 { margin: 0 0 .5rem; font-size: 1.2rem; font-weight: 760; }
  p { margin: 0; color: #4a463e; }
</style>
`
};

export const EXAMPLES: Example[] = [counter, greet, derived, effectClock, todo, card];

export function getExample(slug: string): Example | undefined {
  return EXAMPLES.find((e) => e.slug === slug);
}
