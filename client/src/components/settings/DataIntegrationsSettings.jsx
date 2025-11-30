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
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  return (
    <Stack spacing={2}>
      <SettingsAccordion
        title={t('tooltips.settings.dataExports')}
        description={t('integrations.exportsDescription', {
          defaultValue: 'Request a copy of your data and set monthly reminders.'
        })}
      >
        <Typography variant="body2" sx={mutedTextSx}>
          {t('integrations.exportEmail', { defaultValue: 'We’ll email you a link whenever an export finishes.' })}
        </Typography>
        <FormControlLabel
          control={<Switch checked={autoExportReminders} onChange={onAutoExportRemindersToggle} />}
          label={t('integrations.exportReminders', { defaultValue: 'Remind me to export my data each month' })}
          sx={{
            color: settingsPalette.textPrimary,
            '.MuiFormControlLabel-label': { color: settingsPalette.textPrimary }
          }}
        />
        <Typography variant="caption" sx={mutedTextSx}>
          {t('integrations.exportNudge', {
            defaultValue: 'We’ll send a gentle nudge inside the app when it’s time for your next export.'
          })}
        </Typography>
        <Button
          variant="contained"
          onClick={onDataExport}
          disabled={isOffline}
          title={isOffline ? t('tooltips.settings.requestExport') : undefined}
          sx={{ ...settingsButtonStyles.contained, alignSelf: 'flex-start', mt: 1 }}
        >
          {t('integrations.requestExport', { defaultValue: 'Request data export' })}
        </Button>
        {dataStatus ? (
          <Alert severity={dataStatus.type} onClose={onDismissDataStatus}>
            {dataStatus.message}
          </Alert>
        ) : null}
      </SettingsAccordion>

      <SettingsAccordion
        title={t('tooltips.settings.apiTokens')}
        description={t('integrations.tokensDescription', {
          defaultValue: 'Generate personal access tokens for scripts and integrations.'
        })}
        defaultExpanded={false}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            label={t('integrations.tokenLabel', { defaultValue: 'Token label' })}
            value={tokenLabel}
            onChange={onTokenLabelChange}
            placeholder={t('integrations.tokenPlaceholder', { defaultValue: 'e.g., CLI client' })}
            size="small"
            sx={{ maxWidth: 320 }}
            disabled={isOffline}
          />
          <Button
            variant="outlined"
            onClick={onGenerateToken}
            disabled={isOffline}
            title={isOffline ? t('tooltips.settings.generateTokens') : undefined}
            sx={settingsButtonStyles.outlined}
          >
            {t('integrations.generateToken', { defaultValue: 'Generate API token' })}
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
          {t('integrations.tokenWarning', {
            defaultValue: 'API tokens behave like passwords. Revoke any token you no longer use.'
          })}
        </Typography>
        {isLoadingTokens ? (
          <Stack alignItems="center" spacing={1}>
            <CircularProgress size={20} />
            <Typography variant="body2" sx={mutedTextSx}>
              {t('integrations.loadingTokens', { defaultValue: 'Loading tokens...' })}
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
                    title={isOffline ? t('tooltips.settings.revokeTokens') : undefined}
                    sx={{
                      color: 'var(--danger)',
                      fontWeight: 600,
                      textTransform: 'none',
                      '&:hover': {
                        backgroundColor: 'color-mix(in srgb, var(--danger) 14%, transparent)',
                        color: 'var(--danger)'
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
                  primary={token.label || t('integrations.untitledToken', { defaultValue: 'Untitled token' })}
                  secondary={
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.5}>
                      <Typography component="span" variant="caption" sx={mutedTextSx}>
                        {t('integrations.tokenPreview', {
                          defaultValue: 'Preview: {{value}}',
                          value: token.preview ? `${token.preview}••••` : '••••••'
                        })}
                      </Typography>
                      {token.createdAt ? (
                        <Typography component="span" variant="caption" sx={mutedTextSx}>
                          {t('integrations.tokenCreated', {
                            defaultValue: 'Created {{date}}',
                            date: new Date(token.createdAt).toLocaleString()
                          })}
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
            {t('integrations.noTokens', { defaultValue: 'No active tokens yet.' })}
          </Typography>
        )}
      </SettingsAccordion>
    </Stack>
  );
}

export default DataIntegrationsSettings;
