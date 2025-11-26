const enableListPerfLogs =
  process.env.NODE_ENV !== 'test' &&
  import.meta.env.DEV &&
  import.meta.env.VITE_ENABLE_LIST_PERF_LOGS !== 'false';

const nowMs = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};

const logListPerf = (...args) => {
  if (!enableListPerfLogs) {
    return;
  }
  // eslint-disable-next-line no-console
  console.log('[ListPerf]', ...args);
};

export { enableListPerfLogs, logListPerf, nowMs };
