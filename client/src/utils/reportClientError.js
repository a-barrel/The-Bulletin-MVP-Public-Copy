import { logClientError } from './clientLogger';

export function reportClientError(error, message, context = {}, overrides = {}) {
  if (message) {
    console.error(message, error);
  }
  logClientError(error, context, overrides);
}

export default reportClientError;
