# Logging Playbook

## Inspecting Mongo Log Events

```bash
# connect with mongosh (assumes MONGODB_URI env var is set)
mongosh "$MONGODB_URI" --eval '
  db.logevents.find({ category: "client-api-errors" })
    .sort({ createdAt: -1 })
    .limit(20)
    .forEach(doc => print(doc.createdAt, doc.message))
'
```

### Filter by Pin or User

```js
// inside mongosh
const pinId = "68e061721329566a22d48010";
db.logevents.find({
  "context.pinId": pinId
}).sort({ createdAt: -1 }).pretty();
```

### Tail Local DEV Logs

```bash
# from repo root (offline mode)
tail -f DEV_LOGS/client-api-errors.log DEV_LOGS/http-errors.log
```

### Quick Log Fetch Script

```bash
# fetch the 10 latest hosted logevents (uses server/.env MONGODB_URI_ONLINE)
npm --prefix server run logs:events -- --limit=10

# filter to client-api-errors from the past hour
npm --prefix server run logs:events -- --category=client-api-errors --since-minutes=60
```

The script lives at `server/scripts/fetch-logevents.js` and accepts `--category`, `--severity`,
`--since-minutes`, `--limit`, `--uri`, and `--json`. Pass `--help` for the full list of flags.

Add new query snippets whenever we create additional log categories.
