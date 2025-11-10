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

Add new query snippets whenever we create additional log categories.
