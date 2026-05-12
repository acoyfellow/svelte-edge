# GitHub deploy setup

This repo is intended to be public at `acoyfellow/svelte-edge` and deploy via GitHub Actions.

## One-time repo creation with `gh`

```sh
gh repo create acoyfellow/svelte-edge --public --source=. --remote=origin --push
```

If the remote already exists:

```sh
git remote set-url origin git@github.com:acoyfellow/svelte-edge.git
git push -u origin main
```

## Required GitHub Actions secrets

Use a personal Cloudflare API token/account id, not work OAuth.

```sh
gh secret set CLOUDFLARE_API_TOKEN --repo acoyfellow/svelte-edge --body "$CLOUDFLARE_PERSONAL_API_TOKEN"
gh secret set CLOUDFLARE_ACCOUNT_ID --repo acoyfellow/svelte-edge --body "$CLOUDFLARE_PERSONAL_ACCOUNT_ID"
```

Then deploys happen on pushes to `main`, or manually:

```sh
gh workflow run Deploy --repo acoyfellow/svelte-edge
```

## Local dry-run

```sh
npm ci
npm run check
npm run report
npm run build
```
