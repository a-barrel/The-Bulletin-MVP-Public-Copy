import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded';
import FigmaStatusBar from './FigmaStatusBar';

const figmaTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#9b5de5' },
    secondary: { main: '#f15bb5' },
    text: {
      primary: '#0b0c10',
      secondary: '#5d3889'
    },
    background: {
      default: '#f5effd',
      paper: '#ffffff'
    }
  },
  typography: {
    fontFamily: 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  }
});

function FigmaMobileShell({
  time,
  title,
  children,
  leftSlot,
  rightSlot,
  background = 'linear-gradient(180deg, rgba(243, 235, 255, 0.7) 0%, rgba(236, 248, 253, 0.7) 100%)',
  width = 360,
  contentSpacing = 2,
  disableBackButton = false
}) {
  return (
    <ThemeProvider theme={figmaTheme}>
      <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Paper
          elevation={3}
          sx={(muiTheme) => ({
            width,
            borderRadius: 6,
            overflow: 'hidden',
            background,
            border: '1px solid rgba(93, 56, 137, 0.12)',
            color: muiTheme.palette.text.primary
          })}
        >
          <Stack spacing={contentSpacing} sx={{ p: 2 }}>
            <FigmaStatusBar time={time} />
            <Stack direction="row" alignItems="center" spacing={1.5}>
              {leftSlot ??
                (!disableBackButton ? (
                  <IconButton size="small" color="inherit">
                    <ArrowBackIosNewRoundedIcon fontSize="inherit" />
                  </IconButton>
                ) : (
                  <Box sx={{ width: 32 }} />
                ))}
              <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
                {title}
              </Typography>
              {rightSlot ?? <Box sx={{ width: 32 }} />}
            </Stack>
            {children}
          </Stack>
        </Paper>
      </Box>
    </ThemeProvider>
  );
}

export default FigmaMobileShell;
