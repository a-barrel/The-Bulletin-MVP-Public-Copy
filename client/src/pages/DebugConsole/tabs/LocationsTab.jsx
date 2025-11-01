import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import JsonPreview from '../components/JsonPreview';
import DebugPanel from '../components/DebugPanel';
import useLocationsTools from '../hooks/useLocationsTools';
import { LOCATION_SOURCE_OPTIONS } from '../constants';

function LocationsTab() {
  const {
    locationForm,
    locationStatus,
    setLocationStatus,
    locationResult,
    isSavingLocation,
    handleSaveLocation,
    handleLocationFieldChange,
    resetLocationForm,
    nearbyForm,
    nearbyStatus,
    setNearbyStatus,
    nearbyResults,
    isFetchingNearby,
    handleFetchNearby,
    handleNearbyFieldChange,
    resetNearbyForm,
    historyUserId,
    setHistoryUserId,
    historyStatus,
    setHistoryStatus,
    historyResults,
    isFetchingHistory,
    handleFetchHistory
  } = useLocationsTools();

  const locationAlerts = locationStatus
    ? [
        {
          key: 'location-status',
          severity: locationStatus.type,
          content: locationStatus.message,
          onClose: () => setLocationStatus(null)
        }
      ]
    : [];

  const nearbyAlerts = nearbyStatus
    ? [
        {
          key: 'nearby-status',
          severity: nearbyStatus.type,
          content: nearbyStatus.message,
          onClose: () => setNearbyStatus(null)
        }
      ]
    : [];

  const historyAlerts = historyStatus
    ? [
        {
          key: 'history-status',
          severity: historyStatus.type,
          content: historyStatus.message,
          onClose: () => setHistoryStatus(null)
        }
      ]
    : [];

  return (
    <Stack spacing={2}>
      <DebugPanel
        component="form"
        onSubmit={handleSaveLocation}
        title="Insert location update"
        description="Record or refresh a user's proximity anchor."
        alerts={locationAlerts}
      >
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
                onChange={handleLocationFieldChange('isPublic')}
              />
            }
            label="Allow public proximity lookups"
          />
          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isSavingLocation}>
              {isSavingLocation ? 'Saving...' : 'Save location'}
            </Button>
            <Button type="button" variant="text" onClick={resetLocationForm}>
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={locationResult} />
      </DebugPanel>

      <DebugPanel
        component="form"
        onSubmit={handleFetchNearby}
        title="Fetch nearby users"
        description="List users within a radius of the provided coordinates."
        alerts={nearbyAlerts}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Latitude"
            value={nearbyForm.latitude}
            onChange={handleNearbyFieldChange('latitude')}
            required
          />
          <TextField
            label="Longitude"
            value={nearbyForm.longitude}
            onChange={handleNearbyFieldChange('longitude')}
            required
          />
          <TextField
            label="Max distance (meters)"
            value={nearbyForm.maxDistance}
            onChange={handleNearbyFieldChange('maxDistance')}
          />
          <Button type="submit" variant="outlined" disabled={isFetchingNearby}>
            {isFetchingNearby ? 'Searching…' : 'Fetch nearby'}
          </Button>
          <Button type="button" variant="text" onClick={resetNearbyForm}>
            Reset
          </Button>
        </Stack>
        <JsonPreview data={nearbyResults} />
      </DebugPanel>

      <DebugPanel
        component="form"
        onSubmit={handleFetchHistory}
        title="Fetch location history"
        description="Review recent location records for a specific user."
        alerts={historyAlerts}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="User ID"
            value={historyUserId}
            onChange={(event) => setHistoryUserId(event.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="outlined" disabled={isFetchingHistory}>
            {isFetchingHistory ? 'Loading…' : 'Fetch history'}
          </Button>
        </Stack>
        <JsonPreview data={historyResults} />
      </DebugPanel>
    </Stack>
  );
}

export default LocationsTab;
