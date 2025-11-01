import { useCallback, useState } from 'react';

import {
  fetchLocationHistory,
  fetchNearbyUsers,
  insertLocationUpdate
} from '../../../api/mongoDataApi';
import {
  LOCATION_SOURCE_OPTIONS
} from '../constants';
import {
  parseCommaSeparated,
  parseOptionalDate,
  parseOptionalNumber,
  parseRequiredNumber
} from '../utils';

const INITIAL_LOCATION_FORM = {
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
};

const INITIAL_NEARBY_FORM = {
  latitude: '',
  longitude: '',
  maxDistance: '1609'
};

const useLocationsTools = () => {
  const [locationForm, setLocationForm] = useState(INITIAL_LOCATION_FORM);
  const [locationStatus, setLocationStatus] = useState(null);
  const [locationResult, setLocationResult] = useState(null);
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  const [nearbyForm, setNearbyForm] = useState(INITIAL_NEARBY_FORM);
  const [nearbyStatus, setNearbyStatus] = useState(null);
  const [nearbyResults, setNearbyResults] = useState(null);
  const [isFetchingNearby, setIsFetchingNearby] = useState(false);

  const [historyUserId, setHistoryUserId] = useState('');
  const [historyStatus, setHistoryStatus] = useState(null);
  const [historyResults, setHistoryResults] = useState(null);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);

  const handleLocationFieldChange = useCallback(
    (field) => (event) => {
      const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
      setLocationForm((prev) => ({
        ...prev,
        [field]: value
      }));
    },
    []
  );

  const handleNearbyFieldChange = useCallback(
    (field) => (event) => {
      setNearbyForm((prev) => ({
        ...prev,
        [field]: event.target.value
      }));
    },
    []
  );

  const handleSaveLocation = useCallback(
    async (event) => {
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
    },
    [locationForm]
  );

  const handleFetchNearby = useCallback(
    async (event) => {
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
    },
    [nearbyForm]
  );

  const handleFetchHistory = useCallback(
    async (event) => {
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
    },
    [historyUserId]
  );

  const resetLocationForm = useCallback(() => {
    setLocationForm(INITIAL_LOCATION_FORM);
    setLocationStatus(null);
    setLocationResult(null);
  }, []);

  const resetNearbyForm = useCallback(() => {
    setNearbyForm(INITIAL_NEARBY_FORM);
    setNearbyStatus(null);
    setNearbyResults(null);
  }, []);

  return {
    locationForm,
    setLocationForm,
    locationStatus,
    setLocationStatus,
    locationResult,
    isSavingLocation,
    handleSaveLocation,
    handleLocationFieldChange,
    resetLocationForm,
    nearbyForm,
    setNearbyForm,
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
  };
};

export default useLocationsTools;
