import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchChatRooms, createChatRoom } from '../../api';
import { buildPinRoomPayload } from '../../utils/chatRoomContract';
import { normalizeId } from '../../utils/mapLocation';

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
  const [debugMode, setDebugMode] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [roomsError, setRoomsError] = useState(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState(pinId || null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const pinRoomAttemptedRef = useRef(false);
  const lastLoadKeyRef = useRef(null);
  const isLoadingRef = useRef(false);

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
      const data = await fetchChatRooms({
        pinId: pinId || undefined,
        latitude: locationParams.latitude,
        longitude: locationParams.longitude,
        includeBookmarked: !pinId
      });
      let nextRooms = Array.isArray(data) ? data : [];

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
      if (resolvedRooms.length > 0) {
        const nextSelectedId = existingPinRoom?._id || resolvedRooms[0]._id;
        const desiredId = normalizeId(selectedRoomId);
        const desiredRoom = desiredId
          ? resolvedRooms.find((room) => normalizeId(room._id) === desiredId)
          : null;
        const finalSelectedId = desiredRoom ? desiredRoom._id : nextSelectedId;
        setSelectedRoomId(finalSelectedId);
        const match =
          resolvedRooms.find((room) => normalizeId(room._id) === normalizeId(finalSelectedId)) ||
          resolvedRooms[0];
        setSelectedRoom(match);
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
  }, [authUser, locationParams.latitude, locationParams.longitude, pinId]);

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
