import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { fetchStorageObjects } from '../../../api';
import formatDateTime, { formatRelativeTime } from '../../../utils/dates';
import DebugPanel from '../components/DebugPanel';

const DEFAULT_PREFIX = 'debug/';

const normalizePrefix = (raw) => {
  if (typeof raw !== 'string') {
    return '';
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/^\/+/, '');
};

const formatBytes = (value) => {
  const size = Number(value);
  if (!Number.isFinite(size) || size < 0) {
    return 'Unknown size';
  }
  if (size === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const adjusted = size / 1024 ** exponent;
  return `${adjusted.toFixed(adjusted >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const formatTimestamp = (value) => {
  if (!value) {
    return 'Unknown updated time';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown updated time';
  }
  const relative = formatRelativeTime(date);
  const absolute = formatDateTime(date);
  return relative ? `${relative} (${absolute})` : absolute || 'Unknown updated time';
};

function FirebaseStorageTab() {
  const [prefixInput, setPrefixInput] = useState(DEFAULT_PREFIX);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [files, setFiles] = useState([]);
  const [lastFetchedPrefix, setLastFetchedPrefix] = useState(DEFAULT_PREFIX);

  const loadObjects = useCallback(async (rawPrefix) => {
    const normalized = normalizePrefix(rawPrefix);
    setIsLoading(true);
    setError(null);
    try {
      const payload = await fetchStorageObjects({ prefix: normalized });
      setFiles(Array.isArray(payload?.files) ? payload.files : []);
      setLastFetchedPrefix(
        typeof payload?.prefix === 'string' ? payload.prefix : normalized
      );
    } catch (err) {
      console.error('Failed to load Firebase Storage objects:', err);
      setFiles([]);
      setError(err instanceof Error ? err.message : 'Failed to load Firebase Storage objects.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadObjects(DEFAULT_PREFIX);
  }, [loadObjects]);

  const handleCopy = useCallback(async (text) => {
    if (!text) {
      return;
    }
    if (
      typeof navigator === 'undefined' ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== 'function'
    ) {
      console.warn('Clipboard API is not available in this environment.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.warn('Failed to copy text to clipboard:', err);
    }
  }, []);

  const relativeName = (name) => {
    if (!name) {
      return '';
    }
    const prefix = lastFetchedPrefix ? `${lastFetchedPrefix}` : '';
    if (prefix && name.startsWith(prefix)) {
      return name.slice(prefix.length) || name;
    }
    return name;
  };

  const hasFiles = files.length > 0;

  const alerts = error
    ? [
        {
          key: 'error',
          severity: 'error',
          content: error,
          onClose: () => setError(null)
        }
      ]
    : [];

  return (
    <DebugPanel
      title="Firebase Storage Explorer"
      description="List objects stored in your Firebase Storage bucket to verify uploads and CDN access."
      alerts={alerts}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        <TextField
          label="Folder prefix"
          value={prefixInput}
          onChange={(event) => setPrefixInput(event.target.value)}
          placeholder="debug/"
          helperText="Enter a folder path inside the bucket"
          fullWidth
        />
        <Stack direction={{ xs: 'row', sm: 'row' }} spacing={1}>
          <Button
            type="button"
            variant="contained"
            onClick={() => loadObjects(prefixInput)}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Load objects'}
          </Button>
          <Button
            type="button"
            variant="outlined"
            onClick={() => loadObjects(lastFetchedPrefix)}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      <Typography variant="body2" color="text.secondary">
        Showing objects under prefix:{' '}
        <Typography component="span" variant="body2" color="text.primary">
          {lastFetchedPrefix || '(entire bucket)'}
        </Typography>
      </Typography>

      {isLoading ? (
        <Stack direction="row" spacing={2} alignItems="center">
          <CircularProgress size={24} />
          <Typography variant="body2" color="text.secondary">
            Fetching objects from Firebase Storage...
          </Typography>
        </Stack>
      ) : null}

      {!isLoading && !hasFiles && !error ? (
        <Typography variant="body2" color="text.secondary">
          No objects were found for this prefix.
        </Typography>
      ) : null}

      {!isLoading && hasFiles ? (
        <Stack spacing={2}>
          {files.map((file) => {
            const isImage = file?.contentType?.startsWith('image/');
            const previewName = relativeName(file?.name);
            return (
              <Paper
                key={file.name}
                variant="outlined"
                sx={{
                  p: 2,
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 2
                }}
              >
                {isImage && file.downloadUrl ? (
                  <Box
                    component="img"
                    src={file.downloadUrl}
                    alt={file.name}
                    sx={{
                      width: { xs: '100%', sm: 160 },
                      height: { xs: 160, sm: 120 },
                      objectFit: 'cover',
                      borderRadius: 1,
                      border: (theme) => `1px solid ${theme.palette.divider}`
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: { xs: '100%', sm: 160 },
                      height: { xs: 160, sm: 120 },
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 1,
                      border: (theme) => `1px dashed ${theme.palette.divider}`,
                      color: 'text.secondary',
                      typography: 'caption'
                    }}
                  >
                    No preview
                  </Box>
                )}

                <Stack spacing={1} sx={{ flexGrow: 1 }}>
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle1" sx={{ wordBreak: 'break-all' }}>
                      {previewName || file.name}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="body2" color="text.secondary">
                        {formatBytes(file.size)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatTimestamp(file.updatedAt)}
                      </Typography>
                      {file.contentType ? (
                        <Chip label={file.contentType} size="small" variant="outlined" />
                      ) : null}
                    </Stack>
                  </Stack>

                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {file.downloadUrl ? (
                      <Button
                        type="button"
                        variant="outlined"
                        size="small"
                        href={file.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="text"
                      size="small"
                      onClick={() => handleCopy(file.name)}
                    >
                      Copy object name
                    </Button>
                    {file.downloadUrl ? (
                      <Button
                        type="button"
                        variant="text"
                        size="small"
                        onClick={() => handleCopy(file.downloadUrl)}
                      >
                        Copy URL
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      ) : null}
    </DebugPanel>
  );
}

export default FirebaseStorageTab;
