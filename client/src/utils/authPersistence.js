import { browserLocalPersistence, browserSessionPersistence, setPersistence } from 'firebase/auth';

export const AUTH_PERSISTENCE = {
  LOCAL: 'local',
  SESSION: 'session'
};

const persistenceMap = {
  [AUTH_PERSISTENCE.LOCAL]: browserLocalPersistence,
  [AUTH_PERSISTENCE.SESSION]: browserSessionPersistence
};

export function resolvePersistence(mode) {
  const key = mode && persistenceMap[mode] ? mode : AUTH_PERSISTENCE.LOCAL;
  return persistenceMap[key];
}

export async function applyAuthPersistence(auth, mode = AUTH_PERSISTENCE.LOCAL) {
  const persistence = resolvePersistence(mode);
  await setPersistence(auth, persistence);
  return persistence;
}
