# Contributing

Thanks for checking out `svelte-edge`.

## Local setup

```sh
npm install
npm run dev
```

Before opening a PR, run:

```sh
npm run check
npm run build
```

## Project shape

- `src/worker.tsx` — Worker routes and compile/generation endpoints.
- `src/ui.tsx` — Hono JSX pages.
- `src/examples.ts` — curated Svelte 5 examples.
- `src/input.css` — authored CSS.
- `src/styles.generated.ts` — generated from `src/styles.css`.
- `scripts/generate-og.mjs` — generates social preview assets.
- `scripts/generate-styles.mjs` — embeds generated CSS into TypeScript.

## Style notes

- Use Svelte 5 runes in examples: `$state`, `$derived`, `$props`.
- Public copy should say **bundles**, not artifacts.
- Keep the homepage chat-first. Source and bundle details should stay secondary/collapsed.
- Prefer plain product language over invented metaphors.

## Generated files

These files are checked in intentionally because the Worker imports them at runtime/build time:

- `src/styles.css`
- `src/styles.generated.ts`
- `src/og-image.generated.ts`
- `public/og/index.png`
- `public/og/index.svg`

Regenerate with:

```sh
npm run css
```
