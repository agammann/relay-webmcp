# Deployment

The live application is https://relay.alx21.chatgpt.site. It requires a Worker runtime and a D1 binding named `DB`; it is not a static-only app.

`.openai/hosting.json` identifies the existing Sites project and database binding. Keep its project identity when publishing updates. Build and test locally, push the exact source, package the built Worker and hosting config, save that version, and publish the saved version. Preserve the site's public audience unless intentionally changing it.

Local development uses the placeholder D1 database configuration in `vite.config.ts` with Wrangler's local emulator. Build with `pnpm build`; run `pnpm start --port 3013`. The start command explicitly keeps state under the repository's `.wrangler/state`, which is ignored and outside build output. Stop Wrangler before rebuilding on Windows to avoid locked output files.

The earlier start command used Wrangler's default path relative to the generated config: `dist/server/.wrangler/state`. Export existing local work before upgrading or rebuilding, then import it after starting with the new persistence path. The update does not automatically move a local database or change the production D1 binding.

The runtime initializes the workspaces table with `CREATE TABLE IF NOT EXISTS`. The SQL migration uses the same table and may be applied idempotently. Upgrading does not drop tables or overwrite old global example rows; visitor workspaces are addressed by a new cookie-derived ID.

For self-hosting, configure your own Cloudflare Worker and D1 binding, adjust canonical URLs, and use your own deployment credentials. Do not point local tests at a production database. JSON exports are the supported user-controlled recovery method; there is no account recovery flow or automatic browser-to-browser sync.

After deployment, inspect the public page in a fresh browser context, verify a saved mutation and reload, discover the six native tools in a supporting browser, and check the exact GitHub commit's CI. Local test success alone does not establish that production is working.
