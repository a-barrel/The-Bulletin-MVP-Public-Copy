import PropTypes from 'prop-types';
import { useCallback } from 'react';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';

function UpdatesTabs({ tabs, selected, onSelect, className, ariaLabel, stickyOffset }) {
  const handleSelect = useCallback(
    (label) => {
      if (typeof onSelect === 'function') {
        onSelect(label);
      }
    },
    [onSelect]
  );

  const containerClassName = ['updates-tabs-container', className].filter(Boolean).join(' ');
  const style = stickyOffset ? { '--updates-tabs-top': stickyOffset } : undefined;

  return (
    <Box className={containerClassName} role="tablist" aria-label={ariaLabel} style={style}>
      {tabs.map((tab) => {
        const isActive = selected === tab.label;
        return (
          <Button
            key={tab.label}
            className={`update-tab ${isActive ? 'active' : ''}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => handleSelect(tab.label)}
            tabIndex={isActive ? 0 : -1}
          >
            {tab.label}
            {tab.count > 0 ? <span className="unread-badge">{tab.count}</span> : null}
          </Button>
        );
      })}
    </Box>
  );
}

UpdatesTabs.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      count: PropTypes.number
    })
  ).isRequired,
  selected: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
  className: PropTypes.string,
  ariaLabel: PropTypes.string,
  stickyOffset: PropTypes.string
};

UpdatesTabs.defaultProps = {
  className: '',
  ariaLabel: undefined,
  stickyOffset: undefined
};

export default UpdatesTabs;
