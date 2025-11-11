import { createContext, useContext } from 'react';

const FriendBadgePreferenceContext = createContext({
  enabled: true,
  setEnabled: () => {}
});

export const FriendBadgePreferenceProvider = FriendBadgePreferenceContext.Provider;

export const useFriendBadgePreference = () => useContext(FriendBadgePreferenceContext);

export default FriendBadgePreferenceContext;
