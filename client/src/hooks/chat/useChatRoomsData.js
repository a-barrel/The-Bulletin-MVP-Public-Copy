import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchChatRooms, createChatRoom } from '../../api/mongoDataApi';
import { playBadgeSound } from '../../utils/badgeSound';

const DEFAULT_COORDINATES = {
  latitude: 33.7838,
  longitude: -118.1136
};

export default function useChatRoomsData({
  authUser,
  authLoading,
  isOffline,
  viewerLatitude,
  viewerLongitude
}) {
  const [debugMode, setDebugMode] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [roomsError, setRoomsError] = useState(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState(null);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    latitude: DEFAULT_COORDINATES.latitude,
    longitude: DEFAULT_COORDINATES.longitude,
    radiusMeters: 500,
    isGlobal: false
  });

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

  const loadRooms = useCallback(async () => {
    if (!authUser) {
      return;
    }
    setIsLoadingRooms(true);
    setRoomsError(null);
    try {
      const data = await fetchChatRooms(locationParams);
      setRooms(data);
      if (data.length > 0 && !selectedRoomId) {
        setSelectedRoomId(data[0]._id);
      }
    } catch (error) {
      setRooms([]);
      setRoomsError(error?.message || 'Failed to load chat rooms.');
    } finally {
      setIsLoadingRooms(false);
    }
  }, [authUser, locationParams, selectedRoomId]);

  useEffect(() => {
    if (!authLoading && authUser) {
      loadRooms();
    }
    if (!authUser && !authLoading) {
      setRooms([]);
      setSelectedRoomId(null);
    }
  }, [authLoading, authUser, loadRooms]);

  const handleOpenCreateDialog = useCallback(() => {
    setCreateForm((prev) => ({
      ...prev,
      name: '',
      description: '',
      radiusMeters: 500,
      isGlobal: false
    }));
    setCreateError(null);
    setIsCreateDialogOpen(true);
  }, []);

  const handleCloseCreateDialog = useCallback(() => {
    if (isCreatingRoom) {
      return;
    }
    setIsCreateDialogOpen(false);
  }, [isCreatingRoom]);

  const handleCreateRoom = useCallback(async (event) => {
    event.preventDefault();
    if (!authUser) {
      setCreateError('Sign in to create a chat room.');
      return;
    }
    if (!createForm.name.trim()) {
      setCreateError('Room name is required.');
      return;
    }
    setIsCreatingRoom(true);
    setCreateError(null);
    try {
      const payload = {
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        latitude: Number(createForm.latitude) || DEFAULT_COORDINATES.latitude,
        longitude: Number(createForm.longitude) || DEFAULT_COORDINATES.longitude,
        radiusMeters: Number(createForm.radiusMeters) || 500,
        isGlobal: Boolean(createForm.isGlobal)
      };
      const room = await createChatRoom(payload);
      setRooms((prev) => [room, ...prev]);
      setSelectedRoomId(room._id);
      setIsCreateDialogOpen(false);
    } catch (error) {
      setCreateError(error?.message || 'Failed to create chat room.');
    } finally {
      setIsCreatingRoom(false);
    }
  }, [authUser, createForm]);

  const handleSelectRoom = useCallback((roomId) => {
    setSelectedRoomId(roomId);
  }, []);

  return {
    debugMode,
    setDebugMode,
    rooms,
    roomsError,
    isLoadingRooms,
    loadRooms,
    selectedRoomId,
    setSelectedRoomId,
    handleSelectRoom,
    isCreateDialogOpen,
    handleOpenCreateDialog,
    handleCloseCreateDialog,
    handleCreateRoom,
    isCreatingRoom,
    createForm,
    setCreateForm,
    createError,
    locationParams
  };
}
