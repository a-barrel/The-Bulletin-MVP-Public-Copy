import { createContext, useContext } from 'react';

const NavOverlayContext = createContext({
  handleBack: null,
  previousNavPath: null,
  previousNavPage: null
});

export const NavOverlayProvider = NavOverlayContext.Provider;

export const useNavOverlay = () => useContext(NavOverlayContext);

export default NavOverlayContext;

