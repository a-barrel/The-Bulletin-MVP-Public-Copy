import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt';
import EventNoteIcon from '@mui/icons-material/EventNote';
import ForumIcon from '@mui/icons-material/Forum';
import MapIcon from '@mui/icons-material/Map';
import RefreshIcon from '@mui/icons-material/Refresh';
import { createPin, fetchPinById, fetchPinsNearby } from '../api/mongoDataApi';

export const pageConfig = {
  id: 'create-pin',
  label: 'Create Pin',
  icon: AddLocationAltIcon,
  path: '/create-pin',
  order: 2,
  protected: true,
  showInNav: true
};

const INITIAL_COORDINATES = {
  latitude: '33.7838',
  longitude: '-118.1136'
};

const formatDateTimeLocal = (date) => {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - timezoneOffsetMs);
  return localDate.toISOString().slice(0, 16);
};

const METERS_PER_MILE = 1609.34;

function CreatePinPage() {
  const [pinType, setPinType] = useState('event');
  const [formState, setFormState] = useState({
    title: '',
    description: '',
    latitude: INITIAL_COORDINATES.latitude,
    longitude: INITIAL_COORDINATES.longitude,
    proximityRadiusMeters: '1609',
    startDate: '',
    endDate: '',
    expiresAt: '',
    addressPrecise: '',
    addressCity: '',
    addressState: '',
    addressPostalCode: '',
    addressCountry: '',
    approximateCity: '',
    approximateState: '',
    approximateCountry: '',
    approximateFormatted: ''
  });
  const [status, setStatus] = useState(null);
  const [createdPin, setCreatedPin] = useState(null);
  const [pinIdInput, setPinIdInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingPin, setIsFetchingPin] = useState(false);
  const [distanceMiles, setDistanceMiles] = useState('5');
  const [nearbyPins, setNearbyPins] = useState([]);
  const [isFetchingNearby, setIsFetchingNearby] = useState(false);

  const isEvent = useMemo(() => pinType === 'event', [pinType]);

  const handlePinTypeChange = (_event, value) => {
    if (value) {
      setPinType(value);
      setStatus(null);
    }
  };

  const handleFieldChange = (field) => (event) => {
    const { value } = event.target;
    setFormState((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const applyPreset = (type, values) => {
    setStatus(null);
    setPinType(type);
    setFormState((prev) => ({
      ...prev,
      ...values
    }));
  };

  const handleAutofillEvent = () => {
    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60 * 1000);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

    applyPreset('event', {
      title: 'Community Beach Cleanup',
      description:
        'Help us tidy the shoreline this weekend. Gloves, bags, and refreshments provided.',
      latitude: '33.7683',
      longitude: '-118.1956',
      proximityRadiusMeters: '1200',
      startDate: formatDateTimeLocal(start),
      endDate: formatDateTimeLocal(end),
      expiresAt: '',
      addressPrecise: 'Long Beach Shoreline Marina',
      addressCity: 'Long Beach',
      addressState: 'CA',
      addressPostalCode: '90802',
      addressCountry: 'USA',
      approximateCity: '',
      approximateState: '',
      approximateCountry: '',
      approximateFormatted: ''
    });
  };

const handleAutofillDiscussion = () => {
  const expires = new Date(Date.now() + 48 * 60 * 60 * 1000);

  applyPreset('discussion', {
    title: 'Neighborhood Watch Check-in',
      description:
        'Share recent observations around the neighborhood so we can coordinate patrols.',
      latitude: '33.7838',
      longitude: '-118.1136',
      proximityRadiusMeters: '800',
      startDate: '',
      endDate: '',
      expiresAt: formatDateTimeLocal(expires),
      addressPrecise: '',
      addressCity: '',
      addressState: '',
      addressPostalCode: '',
      addressCountry: '',
      approximateCity: 'Long Beach',
      approximateState: 'CA',
      approximateCountry: 'USA',
    approximateFormatted: 'Long Beach, CA'
  });
};

  const handleDistanceChange = (event) => {
    setDistanceMiles(event.target.value);
  };

  const handleFetchNearbyPins = async () => {
    setStatus(null);
    const miles = Number.parseFloat(distanceMiles);
    if (Number.isNaN(miles) || miles <= 0) {
      setStatus({ type: 'error', message: 'Provide a distance in miles greater than 0.' });
      return;
    }

    let latitude;
    let longitude;
    try {
      latitude = parseCoordinate(formState.latitude, 'Latitude');
      longitude = parseCoordinate(formState.longitude, 'Longitude');
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
      return;
    }

    try {
      setIsFetchingNearby(true);
      setNearbyPins([]);
      const pins = await fetchPinsNearby({
        latitude,
        longitude,
        distanceMiles: miles
      });
      setNearbyPins(pins);
      setStatus({
        type: 'success',
        message: pins.length
          ? `Loaded ${pins.length} pin${pins.length === 1 ? '' : 's'} within ${miles} miles.`
          : `No pins found within ${miles} miles.`
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Failed to fetch nearby pins.' });
    } finally {
      setIsFetchingNearby(false);
    }
  };

  const formatDistanceMiles = (meters) => {
    if (meters === undefined || meters === null) {
      return null;
    }
    return (meters / METERS_PER_MILE).toFixed(1);
  };

  const parseCoordinate = (value, label) => {
    const numeric = Number.parseFloat(value);
    if (Number.isNaN(numeric)) {
      throw new Error(`${label} must be a valid number`);
    }
    return numeric;
  };

  const parseDate = (value, label) => {
    if (!value) {
      throw new Error(`${label} is required`);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`${label} must be a valid date`);
    }
    return parsed.toISOString();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(null);

    let payload;
    try {
      const latitude = parseCoordinate(formState.latitude, 'Latitude');
      const longitude = parseCoordinate(formState.longitude, 'Longitude');
      const proximityRadius = formState.proximityRadiusMeters
        ? Number.parseInt(formState.proximityRadiusMeters, 10)
        : undefined;

      if (proximityRadius !== undefined && Number.isNaN(proximityRadius)) {
        throw new Error('Proximity radius must be a valid number');
      }

      payload = {
        type: pinType,
        title: formState.title.trim(),
        description: formState.description.trim(),
        coordinates: {
          latitude,
          longitude
        },
        proximityRadiusMeters: proximityRadius
      };

      if (!payload.title) {
        throw new Error('Title is required');
      }
      if (!payload.description) {
        throw new Error('Description is required');
      }

      if (isEvent) {
        const startDateIso = parseDate(formState.startDate, 'Start date');
        const endDateIso = parseDate(formState.endDate, 'End date');
        payload.startDate = startDateIso;
        payload.endDate = endDateIso;

        if (formState.addressPrecise.trim()) {
          payload.address = {
            precise: formState.addressPrecise.trim(),
            components: {
              line1: formState.addressPrecise.trim(),
              city: formState.addressCity.trim() || undefined,
              state: formState.addressState.trim() || undefined,
              postalCode: formState.addressPostalCode.trim() || undefined,
              country: formState.addressCountry.trim() || undefined
            }
          };
        }
      } else {
        payload.expiresAt = parseDate(formState.expiresAt, 'Expires at');
        const approx = {
          city: formState.approximateCity.trim() || undefined,
          state: formState.approximateState.trim() || undefined,
          country: formState.approximateCountry.trim() || undefined,
          formatted: formState.approximateFormatted.trim() || undefined
        };
        if (Object.values(approx).some((value) => Boolean(value))) {
          payload.approximateAddress = approx;
        }
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await createPin(payload);
      setCreatedPin(result);
      setPinIdInput(result?._id ?? '');
      let statusMessage = 'Pin created successfully.';

      if (result?._id) {
        try {
          const persistedPin = await fetchPinById(result._id);
          setCreatedPin(persistedPin);
          statusMessage = 'Pin created and loaded from MongoDB.';
        } catch (reloadError) {
          console.warn('Failed to reload pin after creation', reloadError);
          statusMessage = 'Pin created successfully. Reloading from MongoDB failed.';
        }
      }

      setStatus({ type: 'success', message: statusMessage });
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Failed to create pin.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFetchPin = async () => {
    const pinId = pinIdInput.trim();
    if (!pinId) {
      setStatus({ type: 'error', message: 'Provide a Pin ID to fetch.' });
      return;
    }

    try {
      setIsFetchingPin(true);
      const pin = await fetchPinById(pinId);
      setCreatedPin(pin);
      setStatus({ type: 'success', message: 'Pin loaded from MongoDB.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Failed to fetch pin.' });
    } finally {
      setIsFetchingPin(false);
    }
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        p: { xs: 2, sm: 4 }
      }}
    >
      <Stack spacing={3} sx={{ width: '100%', maxWidth: 960 }}>
        <Typography variant="h4" component="h1">
          Prototype: Create a Pin
        </Typography>

        {status && (
          <Alert severity={status.type} onClose={() => setStatus(null)}>
            {status.message}
          </Alert>
        )}

        <Paper
          component="form"
          onSubmit={handleSubmit}
          sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Pin Details
            </Typography>
            <ToggleButtonGroup
              value={pinType}
              exclusive
              color="primary"
              onChange={handlePinTypeChange}
              size="small"
            >
              <ToggleButton value="event" aria-label="Event pin">
                <Stack direction="row" spacing={1} alignItems="center">
                  <EventNoteIcon fontSize="small" />
                  <span>Event</span>
                </Stack>
              </ToggleButton>
              <ToggleButton value="discussion" aria-label="Discussion pin">
                <Stack direction="row" spacing={1} alignItems="center">
                  <ForumIcon fontSize="small" />
                  <span>Discussion</span>
                </Stack>
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            justifyContent="flex-end"
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <Button
              type="button"
              variant="outlined"
              size="small"
              startIcon={<EventNoteIcon fontSize="small" />}
              onClick={handleAutofillEvent}
            >
              Autofill Event
            </Button>
            <Button
              type="button"
              variant="outlined"
              size="small"
              startIcon={<ForumIcon fontSize="small" />}
              onClick={handleAutofillDiscussion}
            >
              Autofill Discussion
            </Button>
          </Stack>

          <TextField
            required
            label="Title"
            value={formState.title}
            onChange={handleFieldChange('title')}
            placeholder="Community meetup"
          />

          <TextField
            required
            multiline
            minRows={3}
            label="Description"
            value={formState.description}
            onChange={handleFieldChange('description')}
            placeholder="Share what this pin is about..."
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              required
              label="Latitude"
              value={formState.latitude}
              onChange={handleFieldChange('latitude')}
              InputProps={{ inputMode: 'decimal' }}
            />
            <TextField
              required
              label="Longitude"
              value={formState.longitude}
              onChange={handleFieldChange('longitude')}
              InputProps={{ inputMode: 'decimal' }}
            />
            <TextField
              label="Proximity radius (meters)"
              value={formState.proximityRadiusMeters}
              onChange={handleFieldChange('proximityRadiusMeters')}
              helperText="Defaults to ~1 mile if left blank"
            />
          </Stack>

          {isEvent ? (
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  required
                  label="Start date"
                  type="datetime-local"
                  value={formState.startDate}
                  onChange={handleFieldChange('startDate')}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  required
                  label="End date"
                  type="datetime-local"
                  value={formState.endDate}
                  onChange={handleFieldChange('endDate')}
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>

              <Divider flexItem />

              <Typography variant="subtitle1">Optional event address</Typography>
              <Stack spacing={2}>
                <TextField
                  label="Precise address / venue name"
                  value={formState.addressPrecise}
                  onChange={handleFieldChange('addressPrecise')}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="City"
                    value={formState.addressCity}
                    onChange={handleFieldChange('addressCity')}
                  />
                  <TextField
                    label="State"
                    value={formState.addressState}
                    onChange={handleFieldChange('addressState')}
                  />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Postal code"
                    value={formState.addressPostalCode}
                    onChange={handleFieldChange('addressPostalCode')}
                  />
                  <TextField
                    label="Country"
                    value={formState.addressCountry}
                    onChange={handleFieldChange('addressCountry')}
                  />
                </Stack>
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <TextField
                required
                label="Expires at"
                type="datetime-local"
                value={formState.expiresAt}
                onChange={handleFieldChange('expiresAt')}
                InputLabelProps={{ shrink: true }}
              />

              <Divider flexItem />

              <Typography variant="subtitle1">Optional approximate address</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="City"
                  value={formState.approximateCity}
                  onChange={handleFieldChange('approximateCity')}
                />
                <TextField
                  label="State"
                  value={formState.approximateState}
                  onChange={handleFieldChange('approximateState')}
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Country"
                  value={formState.approximateCountry}
                  onChange={handleFieldChange('approximateCountry')}
                />
                <TextField
                  label="Formatted location label"
                  value={formState.approximateFormatted}
                  onChange={handleFieldChange('approximateFormatted')}
                />
              </Stack>
            </Stack>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="flex-end">
            <Button
              type="submit"
              variant="contained"
              startIcon={<AddLocationAltIcon />}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Posting…' : 'Post Pin'}
            </Button>
          </Stack>
        </Paper>

        <Paper sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h6">Test saved pin</Typography>
          <Typography variant="body2" color="text.secondary">
            Use this section to fetch the pin you just created directly from MongoDB via the API.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <TextField
              label="Pin ID"
              value={pinIdInput}
              onChange={(event) => setPinIdInput(event.target.value)}
              placeholder="Paste a pin id"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <MapIcon fontSize="small" color="action" />
                  </InputAdornment>
                )
              }}
            />
            <Button
              type="button"
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleFetchPin}
              disabled={isFetchingPin}
            >
              {isFetchingPin ? 'Loading…' : 'Fetch Pin'}
            </Button>
          </Stack>

          {createdPin && (
            <Box component="pre" sx={{ mt: 2, backgroundColor: 'grey.900', p: 2, borderRadius: 2, overflowX: 'auto' }}>
              {JSON.stringify(createdPin, null, 2)}
            </Box>
          )}
        </Paper>

        <Paper sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h6">Find nearby pins</Typography>
          <Typography variant="body2" color="text.secondary">
            Search for pins near the coordinates above to verify radius queries.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <TextField
              label="Distance (miles)"
              value={distanceMiles}
              onChange={handleDistanceChange}
              InputProps={{ inputMode: 'decimal' }}
              sx={{ width: { xs: '100%', sm: 200 } }}
            />
            <Button
              type="button"
              variant="outlined"
              startIcon={<MapIcon />}
              onClick={handleFetchNearbyPins}
              disabled={isFetchingNearby}
            >
              {isFetchingNearby ? 'Searching…' : 'Fetch nearby pins'}
            </Button>
          </Stack>

          {nearbyPins.length > 0 ? (
            <Stack spacing={1}>
              {nearbyPins.map((pin) => {
                const distanceLabel = formatDistanceMiles(pin.distanceMeters);
                return (
                  <Paper key={pin._id} variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={0.5}>
                      <Typography variant="subtitle1">{pin.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {(pin.type === 'event' ? 'Event' : 'Discussion') + ' pin'}
                        {distanceLabel ? ` • ${distanceLabel} mi away` : ''}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {pin._id}
                      </Typography>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {isFetchingNearby
                ? 'Searching for pins…'
                : 'Enter a distance and fetch to list pins near the provided coordinates.'}
            </Typography>
          )}
        </Paper>
      </Stack>
    </Box>
  );
}

export default CreatePinPage;
