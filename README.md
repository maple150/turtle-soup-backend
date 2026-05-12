# Turtle Back

Cloudflare-native backend for a multiplayer turtle soup game.

## Local Development

1. Install dependencies

```powershell
npm.cmd install
```

2. Create secrets for local development in `.dev.vars`

```env
JWT_ACCESS_SECRET=replace-with-access-secret
JWT_REFRESH_SECRET=replace-with-refresh-secret
JWT_WS_SECRET=replace-with-ws-secret
```

3. Apply D1 migration

```powershell
wrangler d1 execute turtle-db --local --file=./src/db/migrations/0001_init.sql
```

4. Start the worker

```powershell
npm.cmd run dev
```

## Deploy

1. Create Cloudflare resources for D1, KV, R2, Queue, and Durable Object bindings.
2. Update `wrangler.toml` with real resource IDs.
3. Set production secrets:

```powershell
wrangler secret put JWT_ACCESS_SECRET
wrangler secret put JWT_REFRESH_SECRET
wrangler secret put JWT_WS_SECRET
```

4. Run migration on the remote database:

```powershell
wrangler d1 execute turtle-db --remote --file=./src/db/migrations/0001_init.sql
```

5. Deploy:

```powershell
npm.cmd run deploy
```
