# Firebase Auth ↔ MongoDB Sync

Pinpoint treats Firebase Authentication as the source of truth for account identity. The backend now keeps MongoDB user documents in sync with Firebase accounts in both emulator and production environments.

## What happens automatically

- **Server startup** – When the Express server boots and connects to MongoDB, it walks every Firebase Auth account (emulator or production) and ensures a corresponding `User` document exists. New accounts are created, existing records are linked, and missing metadata such as email/display name is backfilled when available.
- **Per-request provisioning** – The `verifyToken` middleware now provisions a MongoDB profile whenever a signed-in Firebase user makes an API request. This covers freshly created accounts without waiting for the next full sync.
- **Offline demo mode** – The offline bearer token continues to work, and the placeholder `offline-demo-user` account is automatically materialized in MongoDB so downstream queries succeed.

## Manual sync command

Run the script whenever you import new accounts into the Firebase Auth emulator or need to verify production data:

```bash
cd server
npm run sync:firebase-users
```

The script:

1. Loads `server/.env` so it respects the same Mongo/Firebase settings as the API.
2. Initializes Firebase Admin against the emulator (in offline mode) or production credentials.
3. Connects to MongoDB and syncs accounts, printing a summary and any skipped users.

No passwords or credential secrets are stored in MongoDB—only the Firebase UID and public profile fields.

## Working with the Auth emulator

1. Populate the emulator via the Firebase CLI or by importing `emulator-data/auth_export`.
2. Start the backend (`npm run server` from the repo root). The startup sync will create/update MongoDB users for each Firebase account.
3. Optionally run the manual sync script after seeding to confirm the counts.

Because MongoDB only stores the Firebase UID, email, display name, and app-specific metadata, the team never has to persist personal passwords—Firebase continues to manage authentication.

> Tip: When the Auth emulator is not running, the sync falls back to `emulator-data/auth_export/accounts.json`, so you can seed MongoDB straight from the checked-in export. Start the emulator whenever you need to mint real tokens for end-to-end login flows.
