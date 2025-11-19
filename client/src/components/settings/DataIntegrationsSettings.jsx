import {
  Alert,
  Button,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import SettingsAccordion from './SettingsAccordion';
import settingsPalette, { mutedTextSx, settingsButtonStyles } from './settingsPalette';

function DataIntegrationsSettings({
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
  onRevokeToken
}) {
  return (
    <Stack spacing={2}>
      <SettingsAccordion
        title="Data exports"
        description="Request a copy of your data and set monthly reminders."
      >
        <Typography variant="body2" sx={mutedTextSx}>
          We’ll email you a link whenever an export finishes.
        </Typography>
        <FormControlLabel
          control={<Switch checked={autoExportReminders} onChange={onAutoExportRemindersToggle} />}
          label="Remind me to export my data each month"
          sx={{
            color: settingsPalette.textPrimary,
            '.MuiFormControlLabel-label': { color: settingsPalette.textPrimary }
          }}
        />
        <Typography variant="caption" sx={mutedTextSx}>
          We’ll send a gentle nudge inside the app when it’s time for your next export.
        </Typography>
        <Button
          variant="contained"
          onClick={onDataExport}
          disabled={isOffline}
          title={isOffline ? 'Reconnect to request an export' : undefined}
          sx={{ ...settingsButtonStyles.contained, alignSelf: 'flex-start', mt: 1 }}
        >
          Request data export
        </Button>
        {dataStatus ? (
          <Alert severity={dataStatus.type} onClose={onDismissDataStatus}>
            {dataStatus.message}
          </Alert>
        ) : null}
      </SettingsAccordion>

      <SettingsAccordion
        title="API tokens"
        description="Generate personal access tokens for scripts and integrations."
        defaultExpanded={false}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            label="Token label"
            value={tokenLabel}
            onChange={onTokenLabelChange}
            placeholder="e.g., CLI client"
            size="small"
            sx={{ maxWidth: 320 }}
            disabled={isOffline}
          />
          <Button
            variant="outlined"
            onClick={onGenerateToken}
            disabled={isOffline}
            title={isOffline ? 'Reconnect to generate tokens' : undefined}
            sx={settingsButtonStyles.outlined}
          >
            Generate API token
          </Button>
        </Stack>
        {tokenStatus ? (
          <Alert severity={tokenStatus.type} onClose={onDismissTokenStatus}>
            {tokenStatus.message}
            {generatedToken && tokenStatus.type !== 'warning' ? (
              <Typography variant="caption" component="div">
                Last token: <code>{generatedToken}</code>
              </Typography>
            ) : null}
          </Alert>
        ) : null}
        <Typography variant="caption" sx={mutedTextSx}>
          API tokens behave like passwords. Revoke any token you no longer use.
        </Typography>
        {isLoadingTokens ? (
          <Stack alignItems="center" spacing={1}>
            <CircularProgress size={20} />
            <Typography variant="body2" sx={mutedTextSx}>
              Loading tokens...
            </Typography>
          </Stack>
        ) : apiTokens.length ? (
          <List dense disablePadding>
            {apiTokens.map((token) => (
              <ListItem
                key={token.id}
                secondaryAction={
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => onRevokeToken(token.id)}
                    disabled={isOffline}
                    title={isOffline ? 'Reconnect to revoke tokens' : undefined}
                    sx={{
                      color: '#B3261E',
                      fontWeight: 600,
                      textTransform: 'none',
                      '&:hover': {
                        backgroundColor: '#FFE5E0',
                        color: '#7A2017'
                      },
                      '&:disabled': {
                        color: settingsPalette.borderSubtle
                      }
                    }}
                  >
                    Revoke
                  </Button>
                }
              >
                <ListItemText
                  primary={token.label || 'Untitled token'}
                  secondary={
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.5}>
                      <Typography component="span" variant="caption" sx={mutedTextSx}>
                        Preview: {token.preview ? `${token.preview}••••` : '••••••'}
                      </Typography>
                      {token.createdAt ? (
                        <Typography component="span" variant="caption" sx={mutedTextSx}>
                          Created {new Date(token.createdAt).toLocaleString()}
                        </Typography>
                      ) : null}
                    </Stack>
                  }
                  primaryTypographyProps={{ sx: { color: settingsPalette.textPrimary, fontWeight: 600 } }}
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography variant="body2" sx={mutedTextSx}>
            No active tokens yet.
          </Typography>
        )}
      </SettingsAccordion>
    </Stack>
  );
}

export default DataIntegrationsSettings;
