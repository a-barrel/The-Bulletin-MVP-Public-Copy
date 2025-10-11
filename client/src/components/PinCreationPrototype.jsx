import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import FigmaMobileShell from './FigmaMobileShell';
import figmaPinCreation from '../data/figmaPinCreation.json';

const PinCreationPrototype = () => {
  const { header, fields } = figmaPinCreation;

  return (
    <FigmaMobileShell
      time={header.time}
      title={header.title}
      contentSpacing={2.5}
      rightSlot={
        <Button size="small" variant="contained" disableElevation sx={{ textTransform: 'none', borderRadius: 999 }}>
          {header.cta}
        </Button>
      }
    >
      <Paper
        elevation={0}
        sx={{
          borderRadius: 4,
          px: 3,
          py: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          backgroundColor: '#ffffff',
          border: '1px solid rgba(93, 56, 137, 0.12)'
        }}
      >
        <TextField
          label="Title"
          placeholder={fields.titlePlaceholder}
          fullWidth
          variant="outlined"
          size="small"
        />

        <TextField
          label="Description"
          placeholder={fields.descriptionPlaceholder}
          multiline
          minRows={3}
          fullWidth
          variant="outlined"
          size="small"
        />

        <Stack direction="row" spacing={1} alignItems="center">
          <ToggleButtonGroup exclusive value={fields.modeLabel}>
            <ToggleButton value={fields.modeLabel} sx={{ textTransform: 'none' }}>
              {fields.modeLabel}
            </ToggleButton>
            <ToggleButton value="Discussion" sx={{ textTransform: 'none' }}>
              Discussion
            </ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="body2" color="text.secondary">
            Choose pin type
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1}>
          <TextField label="Date" value={fields.dateLabel} fullWidth size="small" />
          <TextField label="Time" value={fields.timeLabel} fullWidth size="small" />
        </Stack>

        <Box
          sx={{
            height: 160,
            borderRadius: 3,
            backgroundColor: 'rgba(93, 56, 137, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'text.secondary',
            fontWeight: 600
          }}
        >
          {fields.locationPrompt}
        </Box>
      </Paper>
    </FigmaMobileShell>
  );
};

export default PinCreationPrototype;
