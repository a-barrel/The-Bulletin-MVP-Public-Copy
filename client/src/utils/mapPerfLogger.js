const perfLogCache = new globalThis.Map();

export const logMapPerf = (label, startedAt = null, meta = {}) => {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const duration = startedAt ? now - startedAt : 0;
  const key = `${label}|${JSON.stringify(meta)}`;
  const last = perfLogCache.get(key);
  // Deduplicate identical log payloads that occur back-to-back (e.g., Strict Mode double effects).
  if (last && now - last < 200) {
    return;
  }
  perfLogCache.set(key, now);
  // eslint-disable-next-line no-console
  console.log(`[map-perf] ${label}${startedAt ? '' : ' (instant)'}`, {
    durationMs: Number.isFinite(duration) ? duration.toFixed(1) : 'n/a',
    ...meta
  });
};

export const nowIfPerf = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
