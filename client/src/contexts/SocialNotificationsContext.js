import { createContext, useContext } from 'react';

const SocialNotificationsContext = createContext({
  friendRequestCount: 0,
  friendData: null,
  friendIsLoading: false,
  friendIsProcessing: false,
  friendStatus: null,
  respondToFriendRequest: () => Promise.resolve(),
  sendFriendRequest: () => Promise.resolve(),
  dmThreadCount: 0,
  dmThreads: [],
  dmIsLoading: false,
  dmStatus: null,
  friendAccessDenied: false,
  dmAccessDenied: false,
  isLoading: false,
  refreshAll: () => Promise.resolve()
});

export const SocialNotificationsProvider = SocialNotificationsContext.Provider;

export const useSocialNotificationsContext = () => useContext(SocialNotificationsContext);

export default SocialNotificationsContext;
