import { useCallback, useState } from 'react';
import { signInWithPopup } from 'firebase/auth';

import { auth } from '../firebase';
import { applyAuthPersistence, AUTH_PERSISTENCE } from '../utils/authPersistence';

export default function useProviderSignIn({ remember }) {
  const [isPopupActive, setIsPopupActive] = useState(false);

  const signInWithProvider = useCallback(
    async (providerFactory) => {
      if (isPopupActive) {
        return null;
      }
      setIsPopupActive(true);
      try {
        const provider = typeof providerFactory === 'function' ? providerFactory() : null;
        if (!provider) {
          throw new Error('Provider factory must return an auth provider instance.');
        }
        const persistenceMode = remember ? AUTH_PERSISTENCE.LOCAL : AUTH_PERSISTENCE.SESSION;
        await applyAuthPersistence(auth, persistenceMode);
        return await signInWithPopup(auth, provider);
      } finally {
        setIsPopupActive(false);
      }
    },
    [isPopupActive, remember]
  );

  return {
    signInWithProvider,
    isPopupActive
  };
}
