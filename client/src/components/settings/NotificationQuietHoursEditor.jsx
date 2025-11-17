import { useMemo } from 'react';
import { Stack, Typography, FormControlLabel, Switch, TextField, Box } from '@mui/material';

const QUIET_HOUR_DAYS = [
  { value: 'mon', label: 'Monday' },
  { value: 'tue', label: 'Tuesday' },
  { value: 'wed', label: 'Wednesday' },
  { value: 'thu', label: 'Thursday' },
  { value: 'fri', label: 'Friday' },
  { value: 'sat', label: 'Saturday' },
  { value: 'sun', label: 'Sunday' }
];

const normalizeEntry = (entry, fallback) => {
  if (!entry || typeof entry !== 'object') {
    return fallback;
  }
  return {
    day: fallback.day,
    enabled: entry.enabled ?? fallback.enabled,
    start: typeof entry.start === 'string' ? entry.start : fallback.start,
    end: typeof entry.end === 'string' ? entry.end : fallback.end
  };
};

function NotificationQuietHoursEditor({ quietHours, onChange, disabled }) {
  const schedule = useMemo(() => {
    return QUIET_HOUR_DAYS.map((day) => {
      const fallback = { day: day.value, enabled: false, start: '22:00', end: '07:00' };
      const existing = Array.isArray(quietHours)
        ? quietHours.find((entry) => entry?.day === day.value)
        : null;
      return normalizeEntry(existing, fallback);
    });
  }, [quietHours]);

  const emitChange = (nextEntries) => {
    if (typeof onChange === 'function') {
      onChange(nextEntries);
    }
  };

  const updateEntry = (day, updates) => {
    const next = schedule.map((entry) => {
      if (entry.day !== day) {
        return entry;
      }
      return {
        ...entry,
        ...updates
      };
    });
    emitChange(next);
  };

  return (
    <Stack spacing={1.5}>
      <Stack spacing={0.5}>
        <Typography variant="h6">Quiet hours</Typography>
        <Typography variant="body2" color="text.secondary">
          Pause non-critical notifications during the windows you choose. Critical alerts (security, moderation) still break through.
        </Typography>
      </Stack>

      <Stack spacing={1.25}>
        {schedule.map((entry) => (
          <Box
            key={entry.day}
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { sm: 'center' },
              gap: 1,
              p: 1.25,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={entry.enabled}
                  onChange={(_, value) => updateEntry(entry.day, { enabled: value })}
                  disabled={disabled}
                />
              }
              label={QUIET_HOUR_DAYS.find((day) => day.value === entry.day)?.label || entry.day}
            />
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexGrow: 1 }}
            >
              <TextField
                type="time"
                label="Start"
                value={entry.start}
                onChange={(event) => updateEntry(entry.day, { start: event.target.value || '00:00' })}
                size="small"
                disabled={disabled || !entry.enabled}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                type="time"
                label="End"
                value={entry.end}
                onChange={(event) => updateEntry(entry.day, { end: event.target.value || '00:00' })}
                size="small"
                disabled={disabled || !entry.enabled}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}

export default NotificationQuietHoursEditor;
