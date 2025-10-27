import { createContext, useContext } from 'react';

const UpdatesContext = createContext({
  unreadCount: 0,
  setUnreadCount: () => {}
});

export const UpdatesProvider = UpdatesContext.Provider;

export const useUpdates = () => useContext(UpdatesContext);

export default UpdatesContext;

