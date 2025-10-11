import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import SignalCellularAltRoundedIcon from '@mui/icons-material/SignalCellularAltRounded';
import WifiRoundedIcon from '@mui/icons-material/WifiRounded';
import BatteryFullRoundedIcon from '@mui/icons-material/BatteryFullRounded';

function FigmaStatusBar({ time }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ px: 1, color: 'text.secondary', fontSize: '0.75rem' }}
    >
      <Typography component="span" sx={{ fontWeight: 600 }}>
        {time}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <SignalCellularAltRoundedIcon sx={{ fontSize: '1rem' }} />
        <WifiRoundedIcon sx={{ fontSize: '1rem' }} />
        <BatteryFullRoundedIcon sx={{ fontSize: '1.1rem' }} />
      </Stack>
    </Stack>
  );
}

export default FigmaStatusBar;
