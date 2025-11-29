import { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import runtimeConfig from '../../../config/runtime';
import {
  fetchCurrentUserProfile,
  updateUserProfile
} from '../../../api';
import DebugPanel from '../components/DebugPanel';
import {
  getEffectiveRoleLabel,
  isAlwaysAdminViewer,
  normalizeRoles,
  resolveStoredRoleOverride,
  setStoredRoleOverride
} from '../../../utils/roles';

const BASE_ROLE = runtimeConfig.roles?.baseUserRole || 'user';
const DEVELOPER_ROLE = runtimeConfig.roles?.developerRoleName || 'developer';

function RolesTab() {
  const [viewerProfile, setViewerProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [targetStatus, setTargetStatus] = useState(null);
  const [isApplyingCurrent, setIsApplyingCurrent] = useState(false);
  const [isApplyingTarget, setIsApplyingTarget] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [targetRole, setTargetRole] = useState(DEVELOPER_ROLE);

  const alwaysAdminUserIds = runtimeConfig.roles?.alwaysAdminUserIds || [];
  const alwaysAdminEmails = runtimeConfig.roles?.alwaysAdminEmails || [];

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setCurrentStatus(null);
    try {
      const profile = await fetchCurrentUserProfile();
      const override = resolveStoredRoleOverride();
      setViewerProfile(
        override && profile ? { ...profile, debugRoleOverride: override } : profile
      );
    } catch (error) {
      setCurrentStatus({
        type: 'error',
        message: error.message || 'Failed to load your profile.'
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const applyLocalOverride = useCallback((roleName) => {
    setStoredRoleOverride(roleName);
    setViewerProfile((prev) => (prev ? { ...prev, debugRoleOverride: roleName } : prev));
  }, []);

  const clearLocalOverride = useCallback(() => {
    setStoredRoleOverride(null);
    setViewerProfile((prev) => {
      if (!prev || prev.debugRoleOverride === undefined) {
        return prev;
      }
      const { debugRoleOverride: _debugRoleOverride, ...rest } = prev;
      return rest;
    });
  }, []);

  const normalizedRoles = useMemo(
    () => normalizeRoles(viewerProfile?.roles),
    [viewerProfile]
  );
  const effectiveRole = useMemo(
    () => getEffectiveRoleLabel(viewerProfile),
    [viewerProfile]
  );
  const isAlwaysAdmin = useMemo(
    () => isAlwaysAdminViewer(viewerProfile),
    [viewerProfile]
  );

  const applyRoleUpdate = useCallback(
    async (userId, roleName, { onStatus, setBusy }) => {
      if (!userId || !roleName) {
        return;
      }
      setBusy(true);
      onStatus(null);
      try {
        const updated = await updateUserProfile(userId, { roles: [roleName] });
        if (viewerProfile?._id === userId) {
          clearLocalOverride();
          setViewerProfile(updated);
        }
        onStatus({
          type: 'success',
          message: `Assigned role "${roleName}" to user ${userId}.`
        });
      } catch (error) {
        onStatus({
          type: 'error',
          message: error.message || 'Failed to update user role.'
        });
      } finally {
        setBusy(false);
      }
    },
    [clearLocalOverride, viewerProfile]
  );

  const handleCurrentRoleChange = useCallback(
    async (roleName) => {
      if (!viewerProfile?._id || isApplyingCurrent) {
        return;
      }
      if (runtimeConfig.isOffline) {
        applyLocalOverride(roleName);
        setCurrentStatus({
          type: 'info',
          message: `Offline override applied. Viewing as ${roleName}.`
        });
        return;
      }
      setIsApplyingCurrent(true);
      setCurrentStatus(null);
      try {
        const updated = await updateUserProfile(viewerProfile._id, { roles: [roleName] });
        clearLocalOverride();
        setViewerProfile(updated);
        setCurrentStatus({
          type: 'success',
          message: `Now viewing as ${roleName}.`
        });
      } catch (error) {
        applyLocalOverride(roleName);
        setCurrentStatus({
          type: 'info',
          message: `${error.message || 'Failed to update role.'} Applied a local override for this session.`
        });
      } finally {
        setIsApplyingCurrent(false);
      }
    },
    [applyLocalOverride, clearLocalOverride, isApplyingCurrent, viewerProfile]
  );

  const handleTargetRoleUpdate = useCallback(async () => {
    if (!targetUserId || isApplyingTarget) {
      return;
    }
    await applyRoleUpdate(targetUserId.trim(), targetRole, {
      onStatus: setTargetStatus,
      setBusy: setIsApplyingTarget
    });
  }, [applyRoleUpdate, isApplyingTarget, targetRole, targetUserId]);

  const alerts = [
    currentStatus
      ? {
          key: 'current-status',
          severity: currentStatus.type,
          content: currentStatus.message,
          onClose: () => setCurrentStatus(null)
        }
      : null,
    targetStatus
      ? {
          key: 'target-status',
          severity: targetStatus.type,
          content: targetStatus.message,
          onClose: () => setTargetStatus(null)
        }
      : null
  ].filter(Boolean);

  const roleButtonsDisabled = isLoading || !viewerProfile || isApplyingCurrent;
  const offlineNote = runtimeConfig.isOffline
    ? 'Offline mode: all accounts receive developer access automatically.'
    : null;

  return (
    <DebugPanel
      title="Role Overrides"
      description="Flip between user and developer/admin privileges for quick POV testing."
      alerts={alerts}
    >
      <Stack spacing={3}>
        <Stack spacing={1.5}>
          <Typography variant="h6">Your session</Typography>
          {offlineNote ? (
            <Alert severity="info" sx={{ mb: 1 }}>
              {offlineNote}
            </Alert>
          ) : null}
          <Typography variant="body2">
            Viewer:{' '}
            <strong>{viewerProfile?.displayName || viewerProfile?.username || 'Unknown'}</strong>
          </Typography>
          <Typography variant="body2">
            Firebase UID:{' '}
            <code>{viewerProfile?.firebaseUid || 'Unavailable'}</code>
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip
              label={`Effective: ${effectiveRole}`}
              color={effectiveRole === DEVELOPER_ROLE ? 'success' : 'default'}
            />
            {normalizedRoles.length ? (
              normalizedRoles.map((role) => (
                <Chip key={role} label={role} size="small" variant="outlined" />
              ))
            ) : (
              <Chip label="No roles assigned" size="small" variant="outlined" />
            )}
            {isAlwaysAdmin && (
              <Chip label="Always-admin account" color="info" size="small" />
            )}
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap>
            <Button
              type="button"
              variant="outlined"
              disabled={roleButtonsDisabled || effectiveRole === BASE_ROLE}
              onClick={() => handleCurrentRoleChange(BASE_ROLE)}
            >
              {isApplyingCurrent ? 'Updating…' : `View as ${BASE_ROLE}`}
            </Button>
            <Button
              type="button"
              variant="contained"
              disabled={roleButtonsDisabled || effectiveRole === DEVELOPER_ROLE}
              onClick={() => handleCurrentRoleChange(DEVELOPER_ROLE)}
            >
              {isApplyingCurrent ? 'Updating…' : `View as ${DEVELOPER_ROLE}`}
            </Button>
          </Stack>
        </Stack>

        <Divider />

        <Stack spacing={1.5}>
          <Typography variant="h6">Direct role assignment</Typography>
          <Typography variant="body2" color="text.secondary">
            Need to flip another account before a demo? Paste their MongoDB ObjectId here
            and assign the target role.
          </Typography>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            useFlexGap
            alignItems={{ md: 'flex-end' }}
          >
            <TextField
              label="User Mongo ObjectId"
              value={targetUserId}
              onChange={(event) => setTargetUserId(event.target.value)}
              fullWidth
            />
            <TextField
              select
              label="Role"
              value={targetRole}
              onChange={(event) => setTargetRole(event.target.value)}
              sx={{ minWidth: 160 }}
            >
              {[BASE_ROLE, DEVELOPER_ROLE].map((role) => (
                <MenuItem key={role} value={role}>
                  {role}
                </MenuItem>
              ))}
            </TextField>
            <Button
              type="button"
              variant="contained"
              onClick={handleTargetRoleUpdate}
              disabled={!targetUserId || isApplyingTarget}
            >
              {isApplyingTarget ? 'Applying…' : 'Apply role'}
            </Button>
          </Stack>
        </Stack>

        <Divider />

        <Stack spacing={1}>
          <Typography variant="subtitle1">Always-admin accounts</Typography>
          <Typography variant="body2" color="text.secondary">
            These IDs/emails always receive developer privileges, online or offline.
          </Typography>
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              Firebase UIDs
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {alwaysAdminUserIds.length ? (
                alwaysAdminUserIds.map((uid) => (
                  <Chip key={uid} label={uid} size="small" variant="outlined" />
                ))
              ) : (
                <Chip label="None configured" size="small" variant="outlined" />
              )}
            </Stack>
          </Stack>
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              Emails
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {alwaysAdminEmails.length ? (
                alwaysAdminEmails.map((email) => (
                  <Chip key={email} label={email} size="small" variant="outlined" />
                ))
              ) : (
                <Chip label="None configured" size="small" variant="outlined" />
              )}
            </Stack>
          </Stack>
        </Stack>
      </Stack>
    </DebugPanel>
  );
}

export default RolesTab;
