import PropTypes from 'prop-types';
import { Box, Button, FormControlLabel, Paper, Stack, Switch, Typography } from '@mui/material';
import FeedbackIcon from '@mui/icons-material/FeedbackOutlined';
import settingsPalette from './settingsPalette';
import DataIntegrationsSettings from './DataIntegrationsSettings';

export default function SettingsDataSection({
  isOffline,
  autoExportReminders,
  onAutoExportRemindersToggle,
  onDataExport,
  dataStatus,
  onDismissDataStatus,
  tokenLabel,
  onTokenLabelChange,
  onGenerateToken,
  tokenStatus,
  onDismissTokenStatus,
  generatedToken,
  apiTokens,
  isLoadingTokens,
  onRevokeToken,
  betaOptIn,
  onBetaToggle,
  onOpenFeedback
}) {
  return (
    <Stack spacing={3}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 4,
          backgroundColor: settingsPalette.pastelLavender,
          border: `1px solid ${settingsPalette.borderSubtle}`,
          boxShadow: settingsPalette.shadowSoft
        }}
      >
        <Stack spacing={2}>
          <Typography variant="h6" sx={{ color: settingsPalette.accent, fontWeight: 700 }}>
            Data & API access
          </Typography>
          <DataIntegrationsSettings
            isOffline={isOffline}
            autoExportReminders={autoExportReminders}
            onAutoExportRemindersToggle={onAutoExportRemindersToggle}
            onDataExport={onDataExport}
            dataStatus={dataStatus}
            onDismissDataStatus={onDismissDataStatus}
            tokenLabel={tokenLabel}
            onTokenLabelChange={onTokenLabelChange}
            onGenerateToken={onGenerateToken}
            tokenStatus={tokenStatus}
            onDismissTokenStatus={onDismissTokenStatus}
            generatedToken={generatedToken}
            apiTokens={apiTokens}
            isLoadingTokens={isLoadingTokens}
            onRevokeToken={onRevokeToken}
          />
          <Box
            sx={{
              mt: 1,
              p: 2.5,
              borderRadius: 3,
              border: `1px solid ${settingsPalette.borderSubtle}`,
              backgroundColor: 'var(--color-surface)'
            }}
          >
            <Typography variant="h6" sx={{ color: settingsPalette.accent, fontWeight: 700, mb: 1 }}>
              Beta features
            </Typography>
            <Typography variant="body2" sx={{ color: settingsPalette.textPrimary, mb: 1.5 }}>
              Opt in to preview experimental features. Turn off anytime if you prefer stable features only.
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={betaOptIn}
                  onChange={(event) => onBetaToggle(event.target.checked)}
                  color="primary"
                />
              }
              label="Enable beta features"
              sx={{ color: settingsPalette.textPrimary }}
            />
          </Box>
        </Stack>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, md: 3 },
          borderRadius: 4,
          backgroundColor: settingsPalette.pastelLavender,
          border: `1px solid ${settingsPalette.borderSubtle}`,
          boxShadow: settingsPalette.shadowSoft
        }}
      >
        <Stack spacing={2}>
          <Typography variant="h6" sx={{ color: settingsPalette.accent, fontWeight: 700 }}>
            Anonymous feedback
          </Typography>
          <Typography variant="body2" sx={{ color: settingsPalette.textPrimary }}>
            Share suggestions or bugs with the team. Add contact info if you’d like a follow-up.
          </Typography>
          <Button
            type="button"
            variant="contained"
            startIcon={<FeedbackIcon />}
            onClick={onOpenFeedback}
            disabled={isOffline}
            title={isOffline ? 'Reconnect to share feedback' : undefined}
            sx={{ ...settingsPalette.settingsButtonStyles.contained, alignSelf: { xs: 'stretch', sm: 'flex-start' }, px: 3 }}
          >
            Send feedback
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}

SettingsDataSection.propTypes = {
  isOffline: PropTypes.bool.isRequired,
  autoExportReminders: PropTypes.bool.isRequired,
  onAutoExportRemindersToggle: PropTypes.func.isRequired,
  onDataExport: PropTypes.func.isRequired,
  dataStatus: PropTypes.object,
  onDismissDataStatus: PropTypes.func.isRequired,
  tokenLabel: PropTypes.string.isRequired,
  onTokenLabelChange: PropTypes.func.isRequired,
  onGenerateToken: PropTypes.func.isRequired,
  tokenStatus: PropTypes.object,
  onDismissTokenStatus: PropTypes.func.isRequired,
  generatedToken: PropTypes.string,
  apiTokens: PropTypes.array.isRequired,
  isLoadingTokens: PropTypes.bool.isRequired,
  onRevokeToken: PropTypes.func.isRequired,
  betaOptIn: PropTypes.bool.isRequired,
  onBetaToggle: PropTypes.func.isRequired,
  onOpenFeedback: PropTypes.func.isRequired
};
