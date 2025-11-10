import runtimeConfig from '../config/runtime';

const BLOCKED_PATTERNS = [
  'Declaration dropped',
  'Unknown property',
  'Unknown pseudo-class or pseudo-element',
  'Error in parsing value',
  'Expected color but found',
  'Expected ‘none’, URL, or filter function'
];

const shouldSuppress = (input) => {
  if (!input) {
    return false;
  }
  const text =
    typeof input === 'string'
      ? input
      : input?.message && typeof input.message === 'string'
      ? input.message
      : String(input);
  return BLOCKED_PATTERNS.some((pattern) => text.includes(pattern));
};

const wrapConsoleMethod = (methodName) => {
  if (typeof console === 'undefined' || typeof console[methodName] !== 'function') {
    return;
  }
  const original = console[methodName].bind(console);
  console[methodName] = (...args) => {
    if (args.length && shouldSuppress(args[0])) {
      return;
    }
    original(...args);
  };
};

export const installStyleWarningFilter = () => {
  if (!runtimeConfig.suppressStyleWarnings) {
    return;
  }
  if (typeof window === 'undefined') {
    return;
  }
  if (window.__PINPOINT_STYLE_WARNING_FILTER__) {
    return;
  }
  window.__PINPOINT_STYLE_WARNING_FILTER__ = true;
  wrapConsoleMethod('warn');
  wrapConsoleMethod('error');
};

export default installStyleWarningFilter;
