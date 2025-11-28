import { useCallback, useState } from 'react';
import { createApiToken, fetchApiTokens, revokeApiToken } from '../../api';
import reportClientError from '../../utils/reportClientError';

export default function useApiTokensManager({ isOffline } = {}) {
  const [tokenStatus, setTokenStatus] = useState(null);
  const [generatedToken, setGeneratedToken] = useState(null);
  const [apiTokens, setApiTokens] = useState([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [tokenLabel, setTokenLabel] = useState('');

  const loadApiTokens = useCallback(async () => {
    setIsLoadingTokens(true);
    try {
      const response = await fetchApiTokens();
      setApiTokens(Array.isArray(response?.tokens) ? response.tokens : []);
    } catch (error) {
      reportClientError(error, 'Failed to load API tokens', {
        source: 'SettingsPage.loadApiTokens'
      });
      setTokenStatus({
        type: 'error',
        message: error?.message || 'Failed to load API tokens.'
      });
    } finally {
      setIsLoadingTokens(false);
    }
  }, []);

  const handleGenerateToken = useCallback(async () => {
    if (isOffline) {
      setTokenStatus({ type: 'warning', message: 'Reconnect to generate API tokens.' });
      return;
    }
    setTokenStatus({ type: 'info', message: 'Generating token...' });
    try {
      const response = await createApiToken({
        label: tokenLabel.trim() || undefined
      });
      setTokenLabel('');
      if (response?.token) {
        setApiTokens((prev) => [response.token, ...prev]);
      }
      const secret = response?.secret;
      setGeneratedToken(secret || null);

      if (secret && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(secret);
        setTokenStatus({
          type: 'success',
          message: 'Token created and copied to your clipboard. Store it securely.'
        });
      } else {
        setTokenStatus({
          type: 'info',
          message: secret ? `Token generated: ${secret}` : 'Token created.'
        });
      }
    } catch (error) {
      reportClientError(error, 'Failed to generate API token', {
        source: 'SettingsPage.createApiToken'
      });
      setTokenStatus({
        type: 'error',
        message: error?.message || 'Failed to generate API token.'
      });
    }
  }, [isOffline, tokenLabel]);

  const handleRevokeToken = useCallback(
    async (tokenId) => {
      if (!tokenId) {
        return;
      }
      if (isOffline) {
        setTokenStatus({ type: 'warning', message: 'Reconnect to revoke API tokens.' });
        return;
      }
      try {
        await revokeApiToken(tokenId);
        setApiTokens((prev) => prev.filter((token) => token.id !== tokenId));
        setTokenStatus({
          type: 'success',
          message: 'Token revoked.'
        });
      } catch (error) {
        reportClientError(error, 'Failed to revoke API token', {
          source: 'SettingsPage.revokeApiToken',
          tokenId
        });
        setTokenStatus({
          type: 'error',
          message: error?.message || 'Failed to revoke API token.'
        });
      }
    },
    [isOffline]
  );

  return {
    tokenStatus,
    setTokenStatus,
    generatedToken,
    setGeneratedToken,
    apiTokens,
    isLoadingTokens,
    tokenLabel,
    setTokenLabel,
    loadApiTokens,
    handleGenerateToken,
    handleRevokeToken
  };
}
