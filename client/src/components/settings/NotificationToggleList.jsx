import PropTypes from 'prop-types';
import Stack from '@mui/material/Stack';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import settingsPalette, { mutedTextSx, settingsToggleLabelSx } from './settingsPalette';

function NotificationToggleList({ toggles, values, onToggle, disabled }) {
  return (
    <Stack spacing={1.5}>
      {toggles.map((toggle) => (
        <Box
          key={toggle.key}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            borderRadius: 2,
            border: '1px solid',
            borderColor: settingsPalette.borderSubtle,
            backgroundColor: '#FFFFFF',
            px: 2,
            py: 1.5
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: settingsPalette.textPrimary }}>
              {toggle.label}
            </Typography>
            {toggle.helper ? (
              <Typography variant="body2" sx={mutedTextSx}>
                {toggle.helper}
              </Typography>
            ) : null}
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(values[toggle.key])}
                onChange={(event) => onToggle(toggle.key, event.target.checked)}
                disabled={disabled}
              />
            }
            label=""
            sx={settingsToggleLabelSx}
          />
        </Box>
      ))}
    </Stack>
  );
}

NotificationToggleList.propTypes = {
  toggles: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      helper: PropTypes.string
    })
  ).isRequired,
  values: PropTypes.object.isRequired,
  onToggle: PropTypes.func.isRequired,
  disabled: PropTypes.bool
};

NotificationToggleList.defaultProps = {
  disabled: false
};

export default NotificationToggleList;
