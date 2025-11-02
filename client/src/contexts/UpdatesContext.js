import { createContext, useContext } from 'react';

const UpdatesContext = createContext({
  unreadCount: 0,
  unreadBookmarkCount: 0,
  setUnreadCount: () => {},
  setUnreadBookmarkCount: () => {},
  setUnreadDiscussionsCount: () => {},
  setUnreadEventsCount: () => {},
  refreshUnreadCount: () => Promise.resolve()
});

export const UpdatesProvider = UpdatesContext.Provider;

export const useUpdates = () => useContext(UpdatesContext);

export default UpdatesContext;
