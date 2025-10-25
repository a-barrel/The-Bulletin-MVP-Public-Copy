import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  fetchLocationHistory,
  fetchNearbyUsers,
  insertLocationUpdate
} from '../../../api/mongoDataApi';
import JsonPreview from '../components/JsonPreview';
import { LOCATION_SOURCE_OPTIONS } from '../constants';
import {
  parseCommaSeparated,
  parseOptionalDate,
  parseOptionalNumber,
  parseRequiredNumber
} from '../utils';

function LocationsTab() {
  const [locationForm, setLocationForm] = useState({
    userId: '',
    latitude: '',
    longitude: '',
    accuracy: '',
    source: LOCATION_SOURCE_OPTIONS[0],
    sessionId: '',
    deviceId: '',
    linkedPinIds: '',
    createdAt: '',
    lastSeenAt: '',
    expiresAt: '',
    isPublic: true
  });
  const [locationStatus, setLocationStatus] = useState(null);
  const [locationResult, setLocationResult] = useState(null);
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  const [nearbyForm, setNearbyForm] = useState({ latitude: '', longitude: '', maxDistance: '1609' });
  const [nearbyStatus, setNearbyStatus] = useState(null);
  const [nearbyResults, setNearbyResults] = useState(null);
  const [isFetchingNearby, setIsFetchingNearby] = useState(false);

  const [historyUserId, setHistoryUserId] = useState('');
  const [historyStatus, setHistoryStatus] = useState(null);
  const [historyResults, setHistoryResults] = useState(null);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);

  const handleLocationFieldChange = (field) => (event) => {
    setLocationForm((prev) => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleSaveLocation = async (event) => {
    event.preventDefault();
    setLocationStatus(null);

    try {
      const userId = locationForm.userId.trim();
      if (!userId) {
        throw new Error('User ID is required.');
      }

      const latitude = parseRequiredNumber(locationForm.latitude, 'Latitude');
      const longitude = parseRequiredNumber(locationForm.longitude, 'Longitude');

      const payload = {
        userId,
        coordinates: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        isPublic: locationForm.isPublic,
        source: locationForm.source
      };

      const accuracy = parseOptionalNumber(locationForm.accuracy, 'Accuracy');
      if (accuracy !== undefined) {
        payload.accuracy = accuracy;
        payload.coordinates.accuracy = accuracy;
      }

      const sessionId = locationForm.sessionId.trim();
      if (sessionId) {
        payload.sessionId = sessionId;
      }

      const deviceId = locationForm.deviceId.trim();
      if (deviceId) {
        payload.deviceId = deviceId;
      }

      const linkedPinIds = parseCommaSeparated(locationForm.linkedPinIds);
      if (linkedPinIds.length) {
        payload.linkedPinIds = linkedPinIds;
      }

      const createdAt = parseOptionalDate(locationForm.createdAt, 'Created at');
      if (createdAt) {
        payload.createdAt = createdAt;
      }

      const lastSeenAt = parseOptionalDate(locationForm.lastSeenAt, 'Last seen at');
      if (lastSeenAt) {
        payload.lastSeenAt = lastSeenAt;
      }

      const expiresAt = parseOptionalDate(locationForm.expiresAt, 'Expires at');
      if (expiresAt) {
        payload.expiresAt = expiresAt;
      }

      setIsSavingLocation(true);
      const result = await insertLocationUpdate(payload);
      setLocationResult(result);
      setLocationStatus({ type: 'success', message: 'Location update saved.' });
    } catch (error) {
      setLocationStatus({ type: 'error', message: error.message || 'Failed to save location update.' });
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleFetchNearby = async (event) => {
    event.preventDefault();
    setNearbyStatus(null);

    try {
      const latitude = parseRequiredNumber(nearbyForm.latitude, 'Latitude');
      const longitude = parseRequiredNumber(nearbyForm.longitude, 'Longitude');
      const query = { latitude, longitude };
      const maxDistance = parseOptionalNumber(nearbyForm.maxDistance, 'Max distance');
      if (maxDistance !== undefined) {
        query.maxDistance = maxDistance;
      }

      setIsFetchingNearby(true);
      const results = await fetchNearbyUsers(query);
      setNearbyResults(results);
      setNearbyStatus({
        type: 'success',
        message: `Loaded ${results.length} nearby user${results.length === 1 ? '' : 's'}.`
      });
    } catch (error) {
      setNearbyStatus({ type: 'error', message: error.message || 'Failed to load nearby users.' });
    } finally {
      setIsFetchingNearby(false);
    }
  };

  const handleFetchHistory = async (event) => {
    event.preventDefault();
    setHistoryStatus(null);
    const userId = historyUserId.trim();
    if (!userId) {
      setHistoryStatus({ type: 'error', message: 'User ID is required.' });
      return;
    }

    try {
      setIsFetchingHistory(true);
      const results = await fetchLocationHistory(userId);
      setHistoryResults(results);
      setHistoryStatus({
        type: 'success',
        message: `Loaded ${results.length} location record${results.length === 1 ? '' : 's'}.`
      });
    } catch (error) {
      setHistoryStatus({ type: 'error', message: error.message || 'Failed to load location history.' });
    } finally {
      setIsFetchingHistory(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper
        component="form"
        onSubmit={handleSaveLocation}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Insert location update</Typography>
        <Typography variant="body2" color="text.secondary">
          Record or refresh a user's proximity anchor.
        </Typography>
        {locationStatus && (
          <Alert severity={locationStatus.type} onClose={() => setLocationStatus(null)}>
            {locationStatus.message}
          </Alert>
        )}
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="User ID"
              value={locationForm.userId}
              onChange={handleLocationFieldChange('userId')}
              required
              fullWidth
            />
            <TextField
              label="Source"
              value={locationForm.source}
              onChange={handleLocationFieldChange('source')}
              select
              sx={{ minWidth: 180 }}
            >
              {LOCATION_SOURCE_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Latitude"
              value={locationForm.latitude}
              onChange={handleLocationFieldChange('latitude')}
              required
            />
            <TextField
              label="Longitude"
              value={locationForm.longitude}
              onChange={handleLocationFieldChange('longitude')}
              required
            />
            <TextField
              label="Accuracy (meters)"
              value={locationForm.accuracy}
              onChange={handleLocationFieldChange('accuracy')}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Session ID"
              value={locationForm.sessionId}
              onChange={handleLocationFieldChange('sessionId')}
              fullWidth
            />
            <TextField
              label="Device ID"
              value={locationForm.deviceId}
              onChange={handleLocationFieldChange('deviceId')}
              fullWidth
            />
          </Stack>
          <TextField
            label="Linked pin IDs (comma separated)"
            value={locationForm.linkedPinIds}
            onChange={handleLocationFieldChange('linkedPinIds')}
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Created at"
              type="datetime-local"
              value={locationForm.createdAt}
              onChange={handleLocationFieldChange('createdAt')}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Last seen at"
              type="datetime-local"
              value={locationForm.lastSeenAt}
              onChange={handleLocationFieldChange('lastSeenAt')}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Expires at"
              type="datetime-local"
              value={locationForm.expiresAt}
              onChange={handleLocationFieldChange('expiresAt')}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
          <FormControlLabel
            control={
              <Switch
                checked={locationForm.isPublic}
                onChange={(event) => setLocationForm((prev) => ({ ...prev, isPublic: event.target.checked }))}
              />
            }
            label="Allow public proximity lookups"
          />
          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isSavingLocation}>
              {isSavingLocation ? 'Saving...' : 'Save location'}
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={() =>
                setLocationForm({
                  userId: '',
                  latitude: '',
                  longitude: '',
                  accuracy: '',
                  source: LOCATION_SOURCE_OPTIONS[0],
                  sessionId: '',
                  deviceId: '',
                  linkedPinIds: '',
                  createdAt: '',
                  lastSeenAt: '',
                  expiresAt: '',
                  isPublic: true
                })
              }
            >
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={locationResult} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleFetchNearby}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Fetch nearby users</Typography>
        <Typography variant="body2" color="text.secondary">
          Inspect who is within range of a coordinate.
        </Typography>
        {nearbyStatus && (
          <Alert severity={nearbyStatus.type} onClose={() => setNearbyStatus(null)}>
            {nearbyStatus.message}
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Latitude"
            value={nearbyForm.latitude}
            onChange={(event) => setNearbyForm((prev) => ({ ...prev, latitude: event.target.value }))}
            required
          />
          <TextField
            label="Longitude"
            value={nearbyForm.longitude}
            onChange={(event) => setNearbyForm((prev) => ({ ...prev, longitude: event.target.value }))}
            required
          />
          <TextField
            label="Max distance (meters)"
            value={nearbyForm.maxDistance}
            onChange={(event) => setNearbyForm((prev) => ({ ...prev, maxDistance: event.target.value }))}
          />
        </Stack>
        <Stack direction="row" spacing={2}>
          <Button type="submit" variant="outlined" disabled={isFetchingNearby}>
            {isFetchingNearby ? 'Searching...' : 'Search'}
          </Button>
          <Button type="button" variant="text" onClick={() => setNearbyForm({ latitude: '', longitude: '', maxDistance: '1609' })}>
            Reset
          </Button>
        </Stack>
        <JsonPreview data={nearbyResults} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleFetchHistory}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Fetch location history</Typography>
        <Typography variant="body2" color="text.secondary">
          Review the historical samples associated with a user.
        </Typography>
        {historyStatus && (
          <Alert severity={historyStatus.type} onClose={() => setHistoryStatus(null)}>
            {historyStatus.message}
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="User ID"
            value={historyUserId}
            onChange={(event) => setHistoryUserId(event.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="outlined" disabled={isFetchingHistory}>
            {isFetchingHistory ? 'Loading...' : 'Fetch'}
          </Button>
        </Stack>
        <JsonPreview data={historyResults} />
      </Paper>
    </Stack>
  );
}

export default LocationsTab;
