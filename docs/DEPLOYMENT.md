# Deployment

RelayPlan targets ChatGPT Sites through Vinext and the Cloudflare runtime.

## Bindings

`.openai/hosting.json` declares one D1 binding:

```json
{
  "d1": "DB",
  "r2": null
}
```

The production runtime reads `env.DB` from `cloudflare:workers`. No application secret or OpenAI API key is required.

## Build

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The Sites release process is:

1. Create or reuse the opaque Sites project recorded in `.openai/hosting.json`.
2. Push the exact source commit to the Sites source repository.
3. Package the successful `dist` output with the Sites packaging helper.
4. Save a site version tied to that commit SHA.
5. Deploy that saved version.
6. Verify deployment status, public access, D1 persistence, desktop/mobile UI, and WebMCP read/write behavior on the returned production URL.

Do not invent or preconfigure a deployment URL. Record only the URL returned by a successful production deployment.

## Database

The workspace schema is in `db/schema.ts` and `drizzle/0000_relayplan_workspace.sql`. The API also runs the same `CREATE TABLE IF NOT EXISTS` statements, seeds the demonstration once, and optimizes the database. Mutations use optimistic version checks.

## Rollback

Sites versions are immutable. To roll back, redeploy a previously verified saved version. The reset-demo UI changes workspace content only; it does not alter deployment code.
