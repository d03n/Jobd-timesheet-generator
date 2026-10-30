# Deployment

The app is a static site: `npm run build` writes everything to `dist/`, with relative paths
(`base: './'` in `vite.config.ts`). It's deployed to Cloudflare from the `main` branch.

## Requirements

| Tool | Version | Why |
| --- | --- | --- |
| Node.js | 22.12 or later | Vitest 5 requires it (Vite 8 alone would accept 20.19+) |
| Vite | 6.0 or later | Cloudflare's deploy step refuses older Vite versions (see below) |

If a Cloudflare build fails on the Node version, set `NODE_VERSION=22` in the project's build
settings, or add a `.node-version` file containing `22`.

## Release flow

1. Work on a branch (`feature/…` for features, `release/x.y.z` for fixes going out on their own).
2. Run `npm run build` and `npm test` locally. Both must pass.
3. Open a pull request into `main`. Merging it triggers the Cloudflare deploy.
4. After the deploy, check Excel and PDF export on the live site.
   Some problems only appear in the production bundle (see below).

## Known pitfalls

### Cloudflare: "The version of Vite used in the project cannot be automatically configured"

Cloudflare's deploy step needs Vite 6 or later. The project was moved from Vite 5.3 to Vite 8
(with `@vitejs/plugin-react` 6 and Vitest 5) to fix this.

### PDF export fails only on the deployed site ("Couldn't build the PDF")

`jspdf-autotable`'s package root is a UMD/CommonJS file. Vite 8's bundler (Rolldown) converts
it differently from Vite 5, so `import autoTable from 'jspdf-autotable'` no longer returns a
function in the production bundle. Unit tests don't catch this because they run in Node,
which loads the package differently.

`src/lib/pdf.ts` therefore imports the package's ES-module entry instead:

```ts
import autoTable from 'jspdf-autotable/es';
```

Keep that import as it is. After upgrading Vite, jsPDF or jspdf-autotable, test PDF export
against `npm run build && npm run preview`, not just `npm run dev` or `npm test`.

### `npm run typecheck` fails with TS5094

The script runs `tsc -b --noEmit`, and TypeScript doesn't allow `--noEmit` together with
`--build`. Use `npm run build` (which type-checks) or `npx tsc -p . --noEmit` until the script
is fixed.
