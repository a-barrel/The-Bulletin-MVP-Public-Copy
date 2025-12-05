import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchChatRooms, createChatRoom } from '../../api';
import { buildPinRoomPayload } from '../../utils/chatRoomContract';
import { normalizeId } from '../../utils/mapLocation';
import { useChatRoomCache } from '../../contexts/ChatRoomCacheContext';
import { loadStoredLastRoomId, pickNearestEligibleRoom, storeLastRoomId } from '../../utils/chatRoomSelection';

const DEFAULT_COORDINATES = {
  latitude: 33.7838,
  longitude: -118.1136
};

export default function useChatRoomsData({
  authUser,
  authLoading,
  viewerLatitude,
  viewerLongitude,
  pinId
}) {
  const chatRoomCache = useChatRoomCache();
  const [debugMode, setDebugMode] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [roomsError, setRoomsError] = useState(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState(pinId || null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const pinRoomAttemptedRef = useRef(false);
  const lastLoadKeyRef = useRef(null);
  const isLoadingRef = useRef(false);
  const lastVisitedRoomIdRef = useRef(null);

  const resolvedLatitude = Number.isFinite(viewerLatitude)
    ? viewerLatitude
    : DEFAULT_COORDINATES.latitude;
  const resolvedLongitude = Number.isFinite(viewerLongitude)
    ? viewerLongitude
    : DEFAULT_COORDINATES.longitude;
  const locationParams = useMemo(() => ({
    latitude: resolvedLatitude,
    longitude: resolvedLongitude
  }), [resolvedLatitude, resolvedLongitude]);

  const loadStoredRoomId = useCallback(() => {
    const stored = loadStoredLastRoomId(authUser?.uid);
    lastVisitedRoomIdRef.current = stored;
    return stored;
  }, [authUser?.uid]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    const stored = loadStoredRoomId();
    if (!pinId && !selectedRoomId && stored) {
      setSelectedRoomId(stored);
    }
  }, [authLoading, loadStoredRoomId, pinId, selectedRoomId]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    storeLastRoomId(authUser?.uid, selectedRoomId);
  }, [authLoading, authUser?.uid, selectedRoomId]);

  useEffect(() => {
    pinRoomAttemptedRef.current = false;
    setSelectedRoomId(pinId || null);
    setSelectedRoom(null);
  }, [pinId]);

  const loadRooms = useCallback(async () => {
    if (!authUser) {
      return;
    }
    if (isLoadingRef.current) {
      return;
    }
    isLoadingRef.current = true;
    setIsLoadingRooms(true);
    setRoomsError(null);
    try {
      const cacheKey = `${pinId || 'all'}:${locationParams.latitude}:${locationParams.longitude}`;
      const cached = chatRoomCache.getRooms(cacheKey);
      const cachedFresh = cached ? Date.now() - cached.ts < 60_000 : false;
      let nextRooms = null;
      if (cached && cachedFresh && Array.isArray(cached.rooms)) {
        nextRooms = cached.rooms;
      } else {
        const data = await fetchChatRooms({
          pinId: pinId || undefined,
          latitude: locationParams.latitude,
          longitude: locationParams.longitude,
          includeBookmarked: true
        });
        nextRooms = Array.isArray(data) ? data : [];
      }

      const normalizedPinId = normalizeId(pinId);
      const existingPinRoom =
        normalizedPinId &&
        nextRooms.find((room) => normalizeId(room._id) === normalizedPinId || normalizeId(room.pinId) === normalizedPinId);

      if (!existingPinRoom && nextRooms.length === 0 && pinId && !pinRoomAttemptedRef.current) {
        pinRoomAttemptedRef.current = true;
        try {
          const payload =
            buildPinRoomPayload({
              pinId,
              latitude: locationParams.latitude,
              longitude: locationParams.longitude,
              radiusMeters: 500
            }) || {};
          const room = await createChatRoom(payload);
          nextRooms = room ? [room] : [];
        } catch (error) {
          if (error?.status === 404 || error?.status === 410) {
            setRoomsError('Pin chat has expired.');
            setSelectedRoomId(null);
            setRooms([]);
            return;
          }
          setRoomsError(error?.message || 'Failed to create chat room for pin.');
          nextRooms = [];
        }
      }
      const resolvedRooms = existingPinRoom ? [existingPinRoom, ...nextRooms.filter((room) => room !== existingPinRoom)] : nextRooms;
      setRooms(resolvedRooms);
      chatRoomCache.setRooms(cacheKey, { rooms: resolvedRooms, ts: Date.now() });
      if (resolvedRooms.length > 0) {
        const findRoomById = (roomId) => {
          const normalized = normalizeId(roomId);
          if (!normalized) {
            return null;
          }
          return (
            resolvedRooms.find(
              (room) =>
                normalizeId(room?._id) === normalized || normalizeId(room?.pinId) === normalized
            ) || null
          );
        };

        const storedRoomId = lastVisitedRoomIdRef.current ?? loadStoredRoomId();
        const desiredRoom = findRoomById(selectedRoomId);
        const pinRoomSelection = existingPinRoom || findRoomById(pinId);
        const storedRoom = storedRoomId ? findRoomById(storedRoomId) : null;
        const nearestEligibleRoom =
          pickNearestEligibleRoom(resolvedRooms, locationParams) || null;
        const autoRoom = nearestEligibleRoom || resolvedRooms[0];

        const nextRoom =
          desiredRoom ||
          pinRoomSelection ||
          storedRoom ||
          autoRoom ||
          null;

        const nextSelectedId = nextRoom?._id || null;
        setSelectedRoomId(nextSelectedId);
        setSelectedRoom(nextRoom);
      } else {
        setSelectedRoomId(null);
        setSelectedRoom(null);
      }
    } catch (error) {
      setRooms([]);
      if (error?.status === 404 || error?.status === 410) {
        setRoomsError('Pin chat has expired.');
        setSelectedRoomId(null);
        setSelectedRoom(null);
      } else {
        setRoomsError(error?.message || 'Failed to load chat rooms.');
      }
    } finally {
      isLoadingRef.current = false;
      setIsLoadingRooms(false);
    }
  }, [authUser, chatRoomCache, loadStoredRoomId, locationParams.latitude, locationParams.longitude, pinId, selectedRoomId]);

  useEffect(() => {
    if (!authUser && !authLoading) {
      setRooms([]);
      setSelectedRoomId(null);
      lastLoadKeyRef.current = null;
      return;
    }
    if (authLoading || !authUser) {
      return;
    }
    const loadKey = `${authUser?.uid || 'anon'}:${pinId || 'nopin'}:${locationParams.latitude}:${locationParams.longitude}`;
    if (lastLoadKeyRef.current === loadKey) {
      return;
    }
    lastLoadKeyRef.current = loadKey;
    loadRooms();
  }, [authLoading, authUser, loadRooms, locationParams.latitude, locationParams.longitude, pinId]);

  const handleSelectRoom = useCallback(
    (roomId) => {
      setSelectedRoomId(roomId);
      if (Array.isArray(rooms)) {
        const found = rooms.find((room) => normalizeId(room._id) === normalizeId(roomId));
        if (found) {
          setSelectedRoom(found);
        }
      }
    },
    [rooms]
  );

  useEffect(() => {
    if (!Array.isArray(rooms)) {
      return;
    }
    const normalizedSelected = normalizeId(selectedRoomId);
    if (!normalizedSelected) {
      setSelectedRoom(null);
      return;
    }
    const match = rooms.find((room) => normalizeId(room._id) === normalizedSelected);
    if (match) {
      setSelectedRoom(match);
    }
  }, [rooms, selectedRoomId]);

  useEffect(() => {
    if (!Array.isArray(rooms) || rooms.length === 0) {
      return;
    }
    const normalizedSelected = normalizeId(selectedRoomId);
    const hasSelected = normalizedSelected
      ? rooms.some((room) => normalizeId(room._id) === normalizedSelected)
      : false;
    if (hasSelected) {
      return;
    }

    const findRoomById = (roomId) => {
      const normalized = normalizeId(roomId);
      if (!normalized) {
        return null;
      }
      return (
        rooms.find(
          (room) =>
            normalizeId(room?._id) === normalized || normalizeId(room?.pinId) === normalized
        ) || null
      );
    };

    const storedRoomId = lastVisitedRoomIdRef.current ?? loadStoredRoomId();
    const pinRoomSelection = findRoomById(pinId);
    const storedRoom = storedRoomId ? findRoomById(storedRoomId) : null;
    const nearestEligibleRoom = pickNearestEligibleRoom(rooms, locationParams) || null;
    const autoRoom = nearestEligibleRoom || rooms[0];

    const nextRoom = pinRoomSelection || storedRoom || autoRoom || null;
    const nextSelectedId = nextRoom?._id || null;
    if (nextSelectedId !== selectedRoomId) {
      setSelectedRoomId(nextSelectedId);
    }
    setSelectedRoom(nextRoom);
  }, [loadStoredRoomId, locationParams, pinId, rooms, selectedRoomId]);

  return {
    debugMode,
    setDebugMode,
    rooms,
    roomsError,
    isLoadingRooms,
    loadRooms,
    selectedRoomId,
    selectedRoom,
    setSelectedRoomId,
    handleSelectRoom,
    locationParams
  };
}
