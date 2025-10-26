import { createContext, useContext } from 'react';
import useNetworkStatus from '../hooks/useNetworkStatus';

const NetworkStatusContext = createContext({
  isOnline: true,
  isOffline: false
});

export function NetworkStatusProvider({ children }) {
  const status = useNetworkStatus();
  return (
    <NetworkStatusContext.Provider value={status}>{children}</NetworkStatusContext.Provider>
  );
}

export const useNetworkStatusContext = () => useContext(NetworkStatusContext);

export default NetworkStatusContext;
