import { createContext, useContext } from 'react';

const BadgeSoundContext = createContext({
  enabled: false,
  setEnabled: () => {},
  announceBadgeEarned: () => {}
});

export const BadgeSoundProvider = BadgeSoundContext.Provider;

export const useBadgeSound = () => useContext(BadgeSoundContext);

export default BadgeSoundContext;
