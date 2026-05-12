# SSR evaluation notes

Svelte server compilation works in the Worker today, but evaluating the emitted module is the next hard part.

Example compiled output imports Svelte internals:

```js
import * as $ from 'svelte/internal/server';

export default function EdgeComponent($$renderer, $$props) {
  // ... pushes HTML into renderer
}
```

That means a naive `new Function(compiled.js.code)` is not enough because the output is ESM with imports. Options:

1. **Bundle per component after compile**: compile to SSR JS, then run an in-Worker bundling step that resolves `svelte/internal/server`. Likely too heavy for request path.
2. **Compile + transform imports**: rewrite `import * as $ from 'svelte/internal/server'` to a provided runtime object. Feasible for a narrow prototype, but fragile against compiler output changes.
3. **Dynamic Worker per artifact**: generate a Worker module that imports Svelte normally and deploy via Dynamic Workers. Clean isolation, heavier lifecycle.
4. **Background build with Workflows**: request/publish triggers compile+bundle, stores executable artifact in R2/KV. Most production-friendly.
5. **Use a small server-render shim**: investigate whether Svelte exposes a stable server runtime entry that can be imported statically by the host Worker, then evaluate transformed component body only.

Current conclusion: `/compile?mode=server` is proven. `/render` should be a separate experiment because safe ESM evaluation/import resolution is the real boundary, not the Svelte compiler itself.
