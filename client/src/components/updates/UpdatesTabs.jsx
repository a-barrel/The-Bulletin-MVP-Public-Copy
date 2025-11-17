import PropTypes from 'prop-types';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';

function UpdatesTabs({ tabs, selected, onSelect }) {
  return (
    <Box className="updates-tabs-container">
      {tabs.map((tab) => (
        <Button
          key={tab.label}
          className={`update-tab ${selected === tab.label ? 'active' : ''}`}
          onClick={() => onSelect(tab.label)}
        >
          {tab.label}
          {tab.count > 0 ? <span className="unread-badge">{tab.count}</span> : null}
        </Button>
      ))}
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
  onSelect: PropTypes.func.isRequired
};

export default UpdatesTabs;
