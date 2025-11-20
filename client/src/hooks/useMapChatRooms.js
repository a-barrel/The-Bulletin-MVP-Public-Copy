import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchChatRooms } from '../api/mongoDataApi';
import reportClientError from '../utils/reportClientError';
import { haversineDistanceMeters, formatDistanceMiles } from '../utils/geo';
import { hasValidCoordinates } from '../utils/mapLocation';

export default function useMapChatRooms({ userLocation, isOffline, adminView = false }) {
  const [showChatRooms, setShowChatRooms] = useState(false);
  const [chatRooms, setChatRooms] = useState([]);
  const [isLoadingChatRooms, setIsLoadingChatRooms] = useState(false);
  const [chatRoomsError, setChatRoomsError] = useState(null);
  const [selectedChatRoomId, setSelectedChatRoomId] = useState(null);

  useEffect(() => {
    if (!showChatRooms) {
      setChatRooms([]);
      setChatRoomsError(null);
      setIsLoadingChatRooms(false);
      setSelectedChatRoomId(null);
      return;
    }

    if (isOffline) {
      setChatRooms([]);
      setChatRoomsError('Reconnect to load chat rooms.');
      setIsLoadingChatRooms(false);
      return;
    }

    const latitude = Number.isFinite(userLocation?.latitude) ? userLocation.latitude : undefined;
    const longitude = Number.isFinite(userLocation?.longitude) ? userLocation.longitude : undefined;

    let cancelled = false;
    setIsLoadingChatRooms(true);
    setChatRoomsError(null);

    fetchChatRooms({ latitude, longitude, maxDistanceMiles: 50, adminView })
      .then((rooms) => {
        if (!cancelled) {
          setChatRooms(Array.isArray(rooms) ? rooms : []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          reportClientError(err, 'Failed to load chat rooms:', {
            source: 'useMapChatRooms',
            latitude,
            longitude
          });
          setChatRooms([]);
          setChatRoomsError(err?.message || 'Failed to load chat rooms.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingChatRooms(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [adminView, isOffline, showChatRooms, userLocation]);

  const chatRoomPins = useMemo(() => {
    if (!showChatRooms) {
      return [];
    }

    return chatRooms
      .map((room, index) => {
        const coordinatesArray = room?.coordinates?.coordinates || room?.location?.coordinates;
        if (!Array.isArray(coordinatesArray) || coordinatesArray.length < 2) {
          return null;
        }
        const [longitude, latitude] = coordinatesArray;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }

        const id = room?._id ? String(room._id) : `chat-room-${index}`;
        const distance = hasValidCoordinates(userLocation)
          ? haversineDistanceMeters(userLocation, { latitude, longitude })
          : null;

        return {
          _id: id,
          title: room?.name || 'Chat room',
          type: room?.isGlobal ? 'global-chat-room' : 'chat-room',
          coordinates: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          proximityRadiusMeters: Number.isFinite(room?.radiusMeters) ? room.radiusMeters : undefined,
          description: room?.description || undefined,
          distanceMeters: Number.isFinite(distance) ? distance : undefined,
          metadata: room
        };
      })
      .filter(Boolean);
  }, [chatRooms, showChatRooms, userLocation]);

  useEffect(() => {
    if (!selectedChatRoomId) {
      return;
    }
    if (!chatRooms.some((room) => String(room?._id) === String(selectedChatRoomId))) {
      setSelectedChatRoomId(null);
    }
  }, [chatRooms, selectedChatRoomId]);

  useEffect(() => {
    if (!showChatRooms || !chatRoomPins.length) {
      return;
    }
    if (!selectedChatRoomId) {
      const first = chatRoomPins[0];
      setSelectedChatRoomId(first._id ?? null);
    }
  }, [chatRoomPins, selectedChatRoomId, showChatRooms]);

  const selectedChatRoom = useMemo(() => {
    if (!selectedChatRoomId) {
      return null;
    }
    return chatRooms.find((room) => String(room?._id) === String(selectedChatRoomId)) ?? null;
  }, [chatRooms, selectedChatRoomId]);

  useEffect(() => {
    if (!showChatRooms || !chatRoomPins.length || !hasValidCoordinates(userLocation)) {
      return;
    }
    const distances = chatRoomPins
      .map((pin) => {
        const coords = Array.isArray(pin?.coordinates?.coordinates)
          ? pin.coordinates.coordinates
          : null;
        if (!coords || coords.length < 2) {
          return null;
        }
        const [lon, lat] = coords;
        return {
          pin,
          distance: haversineDistanceMeters(userLocation, { latitude: lat, longitude: lon })
        };
      })
      .filter(Boolean);
    if (!distances.length) {
      return;
    }
    let currentMatch = distances.find((entry) => entry.pin._id === selectedChatRoomId);
    const currentRadius = Number.isFinite(currentMatch?.pin?.proximityRadiusMeters)
      ? currentMatch.pin.proximityRadiusMeters
      : null;
    const currentWithin =
      currentMatch && (currentRadius === null || currentMatch.distance <= currentRadius);
    if (currentWithin) {
      return;
    }
    distances.sort((a, b) => a.distance - b.distance);
    const nextPin = distances[0]?.pin;
    if (nextPin && nextPin._id !== selectedChatRoomId) {
      setSelectedChatRoomId(nextPin._id);
    }
  }, [chatRoomPins, selectedChatRoomId, showChatRooms, userLocation]);

  const selectedChatRoomPin = useMemo(() => {
    if (!selectedChatRoomId) {
      return null;
    }
    return chatRoomPins.find((pin) => pin._id === selectedChatRoomId) ?? null;
  }, [chatRoomPins, selectedChatRoomId]);

  const selectedChatRoomDistanceLabel = useMemo(() => {
    const miles = formatDistanceMiles(selectedChatRoomPin?.distanceMeters, { decimals: 2 });
    return miles ? `${miles} mi` : null;
  }, [selectedChatRoomPin]);

  const selectedChatRoomRadiusLabel = useMemo(() => {
    if (!selectedChatRoom || !Number.isFinite(selectedChatRoom.radiusMeters)) {
      return null;
    }
    const miles = formatDistanceMiles(selectedChatRoom.radiusMeters, { decimals: 2 });
    return miles
      ? `${Math.round(selectedChatRoom.radiusMeters)} m (${miles} mi)`
      : `${Math.round(selectedChatRoom.radiusMeters)} m`;
  }, [selectedChatRoom]);

  const handleMapPinSelect = useCallback(
    (pin) => {
      if (!pin || !showChatRooms) {
        return;
      }
      if (pin.type === 'chat-room' || pin.type === 'global-chat-room') {
        setSelectedChatRoomId(pin._id ?? null);
      }
    },
    [showChatRooms]
  );

  return {
    showChatRooms,
    setShowChatRooms,
    chatRooms,
    chatRoomPins,
    isLoadingChatRooms,
    chatRoomsError,
    setChatRoomsError,
    selectedChatRoomId,
    setSelectedChatRoomId,
    selectedChatRoom,
    selectedChatRoomDistanceLabel,
    selectedChatRoomRadiusLabel,
    handleMapPinSelect
  };
}
