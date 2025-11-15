import { createContext, useContext } from 'react';

const MainNavigationContext = createContext({
  lastMainPath: null,
  lastCorePath: null
});

export const MainNavigationProvider = MainNavigationContext.Provider;

export const useMainNavigationContext = () => useContext(MainNavigationContext);

export default MainNavigationContext;
