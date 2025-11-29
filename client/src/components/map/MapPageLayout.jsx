import PropTypes from 'prop-types';
import { memo } from 'react';
import Navbar from '../Navbar';

function MapPageLayout({ children }) {
  return (
    <div className="map-page">
      <div className="map-page__body">{children}</div>
      <Navbar disableSpacer />
    </div>
  );
}

MapPageLayout.propTypes = {
  children: PropTypes.node.isRequired
};

export default memo(MapPageLayout);
