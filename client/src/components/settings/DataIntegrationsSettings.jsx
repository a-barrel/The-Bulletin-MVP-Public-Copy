import {
  Alert,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemText
} from '@mui/material';

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
      <Typography variant="h6">Data &amp; integrations</Typography>
      <Typography variant="body2" color="text.secondary">
        Export your account data or generate personal access tokens for scripts. We’ll email you a link whenever an export finishes.
      </Typography>
      <FormControlLabel
        control={<Switch checked={autoExportReminders} onChange={onAutoExportRemindersToggle} />}
        label="Remind me to export my data each month"
      />
      <Typography variant="caption" color="text.secondary">
        We’ll send a gentle nudge inside the app when it’s time for your next export.
      </Typography>
      <Stack spacing={1}>
        <Typography variant="subtitle2">Data export</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button
            variant="contained"
            onClick={onDataExport}
            disabled={isOffline}
            title={isOffline ? 'Reconnect to request an export' : undefined}
          >
            Request data export
          </Button>
        </Stack>
        {dataStatus ? (
          <Alert severity={dataStatus.type} onClose={onDismissDataStatus}>
            {dataStatus.message}
          </Alert>
        ) : null}
      </Stack>

      <Divider />

      <Stack spacing={1.5}>
        <Typography variant="subtitle2">API tokens</Typography>
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
        <Typography variant="caption" color="text.secondary">
          API tokens behave like passwords. Revoke any token you no longer use.
        </Typography>
        {isLoadingTokens ? (
          <Stack alignItems="center" spacing={1}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
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
                    color="error"
                    onClick={() => onRevokeToken(token.id)}
                    disabled={isOffline}
                    title={isOffline ? 'Reconnect to revoke tokens' : undefined}
                  >
                    Revoke
                  </Button>
                }
              >
                <ListItemText
                  primary={token.label || 'Untitled token'}
                  secondary={
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.5}>
                      <Typography component="span" variant="caption" color="text.secondary">
                        Preview: {token.preview ? `${token.preview}••••` : '••••••'}
                      </Typography>
                      {token.createdAt ? (
                        <Typography component="span" variant="caption" color="text.secondary">
                          Created {new Date(token.createdAt).toLocaleString()}
                        </Typography>
                      ) : null}
                    </Stack>
                  }
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No active tokens yet.
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}

export default DataIntegrationsSettings;
