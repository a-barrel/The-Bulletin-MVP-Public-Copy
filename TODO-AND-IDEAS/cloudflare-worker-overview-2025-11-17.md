# Cloudflare Worker Overview — 2025-11-17

Professor wanted us to explore edge caching after the demo. Here’s a concise reminder of what a Worker is and how we’ll use it with the current stack (Vercel frontend, Render API, MongoDB, Firebase Auth).

---

## TL;DR
- A **Cloudflare Worker** is a tiny JS/TS script that runs on Cloudflare’s edge network (their CDN POPs).
- Every request to our domain hits the Worker first. The Worker can:
  - Inspect/modify requests.
  - Serve cached responses from Cloudflare’s edge storage.
  - Forward cache misses to our Render backend (which still queries MongoDB).
  - Decide whether to cache based on auth headers, query params, etc.
- Result: first request for a given geohash/filter combo “misses” and hits Render/MongoDB; the Worker caches that JSON and every later request pulls straight from Cloudflare in a few milliseconds.

---

## How It Fits Our Stack
1. **DNS/TLS:** Point `app.pinpoint.com` and `api.pinpoint.com` at Cloudflare. They terminate TLS and run Workers before forwarding to Vercel/Render. (We can keep Vercel’s preview URLs untouched.)
2. **Frontend (Vercel):**
   - Workers mostly pass through HTML/static assets but can turn on `Cache Everything` + `stale-while-revalidate` for JS/CSS so cold Vercel regions are masked.
   - Alternatively, keep Workers minimal and let Cloudflare CDN rules handle static asset caching.
3. **API (Render):**
   - Worker intercepts `/api/pins`, `/api/bookmarks`, `/api/updates`, etc.
   - Build cache keys from `endpoint + geohash + sorted filters + hideHidden flag`.
   - If cached response exists (and the request isn’t user-specific), return it immediately.
   - Otherwise fetch from Render (`fetch(RENDER_API_BASE + url)`), store in cache (30–60 s TTL with `stale-while-revalidate`), and return to the client.
   - When Render mutates pins/bookmarks, hook into the same fan-out queue to call Cloudflare’s purge API for the affected geohash or explicit cache key.
4. **MongoDB:** Only Render talks to MongoDB. Workers never connect directly; they cache Render’s JSON payloads.
5. **Firebase Auth:** Workers forward the `Authorization` header downstream. Default: skip caching when a valid token is present. If we ever need to cache tokenized responses, include a hash of the token in the cache key and set very short TTLs to avoid leaks.

---

## Worker Responsibilities Checklist
- Normalize query params (sort keys, trim strings) so cache keys are deterministic.
- Compute geohash / bounding box from lat/long to support “box” caching.
- Add helpful headers (`x-cache-key`, `cf-cache-status`) for debugging.
- Log cache hits/misses via `console.log` so we can tail via `wrangler tail`.
- Respect a `CLOUDFLARE_BYPASS` env flag that forces pass-through when debugging.

---

## Why It Matters
- **Cold start mask:** Even if Render or Vercel spins up slowly, the Worker already holds warm responses.
- **Lower DB/Render load:** Frequent pin queries hit the edge cache, not MongoDB.
- **Professor’s ask:** Shows we’re serious about geo-aware caching, “boxing” queries, and pushing work to the edge—exactly what he flagged post-demo.

Keep this doc handy when we start Sprint 4 tasks: the first implementation slice is simply “cache `/api/pins` responses by geohash via a Worker + purge hook.” Everything else grows from there.***
