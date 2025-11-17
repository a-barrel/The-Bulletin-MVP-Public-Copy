import { Paper, Stack, Typography, Button } from '@mui/material';

function NotificationBundleSelector({ bundles, onApplyBundle, disabled }) {
  if (!Array.isArray(bundles) || bundles.length === 0) {
    return null;
  }

  const handleApply = (bundle) => {
    if (typeof onApplyBundle === 'function') {
      onApplyBundle(bundle);
    }
  };

  return (
    <Stack spacing={1.5}>
      <Stack spacing={0.5}>
        <Typography variant="h6">Quick bundles</Typography>
        <Typography variant="body2" color="text.secondary">
          Choose a preset to fast-track your notification setup. You can tweak individual toggles afterward.
        </Typography>
      </Stack>

      <Stack spacing={1}>
        {bundles.map((bundle) => (
          <Paper
            key={bundle.id}
            variant="outlined"
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 1.5,
              alignItems: { sm: 'center' },
              justifyContent: 'space-between'
            }}
          >
            <Stack spacing={0.5}>
              <Typography variant="subtitle1" fontWeight={600}>
                {bundle.label}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {bundle.description}
              </Typography>
            </Stack>
            <Button
              variant="contained"
              size="small"
              onClick={() => handleApply(bundle)}
              disabled={disabled}
            >
              Apply
            </Button>
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
}

export default NotificationBundleSelector;
