import AvatarIcon from '../assets/AvatarIcon.svg';
import normalizeObjectId from './normalizeObjectId';

export const getParticipantId = (participant) => {
  if (!participant) {
    return null;
  }
  if (typeof participant === 'string') {
    return normalizeObjectId(participant);
  }
  return normalizeObjectId(
    participant.id ||
      participant._id ||
      (typeof participant?.id === 'object' && participant.id !== null && '$oid' in participant.id
        ? participant.id.$oid
        : null)
  );
};

export const getParticipantDisplayName = (participant) => {
  if (!participant || typeof participant === 'string') {
    return typeof participant === 'string' ? participant : '';
  }
  return (
    participant.displayName ||
    participant.username ||
    participant.name ||
    participant.handle ||
    participant.email ||
    ''
  );
};

export const resolveAvatarSrc = (participant) => {
  if (!participant || typeof participant === 'string') {
    return AvatarIcon;
  }
  const avatarUrl =
    participant.avatar?.url ||
    participant.avatarUrl ||
    participant.avatar ||
    participant.photoUrl ||
    participant.photoURL ||
    null;
  if (!avatarUrl) {
    return AvatarIcon;
  }
  if (typeof avatarUrl === 'string' && avatarUrl.trim()) {
    const trimmed = avatarUrl.trim();
    if (trimmed.startsWith('http') || trimmed.startsWith('data:')) {
      return trimmed;
    }
    return `/${trimmed.replace(/^\/+/, '')}`;
  }
  if (typeof avatarUrl === 'object' && avatarUrl !== null && '$oid' in avatarUrl) {
    return avatarUrl.$oid || AvatarIcon;
  }
  return AvatarIcon;
};

export const resolveThreadParticipants = (thread, viewerId) => {
  if (!thread) {
    return [];
  }
  const participants = Array.isArray(thread.participants) ? thread.participants : [];
  const filtered = participants.filter((participant) => {
    const id = getParticipantId(participant);
    if (!id) {
      return false;
    }
    if (!viewerId) {
      return true;
    }
    return id !== normalizeObjectId(viewerId);
  });
  if (filtered.length) {
    return filtered.map((participant) => getParticipantDisplayName(participant)).filter(Boolean);
  }
  return participants
    .map((participant) => getParticipantDisplayName(participant))
    .filter((name) => typeof name === 'string' && name.trim().length > 0);
};
