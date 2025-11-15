import PropTypes from 'prop-types';
import Stack from '@mui/material/Stack';

function TabPanel({ value, current, children }) {
  if (value !== current) {
    return null;
  }
  return (
    <Stack spacing={3} sx={{ pt: 3 }}>
      {children}
    </Stack>
  );
}

TabPanel.propTypes = {
  value: PropTypes.string.isRequired,
  current: PropTypes.string.isRequired,
  children: PropTypes.node
};

TabPanel.defaultProps = {
  children: null
};

export default TabPanel;
