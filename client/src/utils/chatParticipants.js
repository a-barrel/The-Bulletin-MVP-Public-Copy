import normalizeObjectId from './normalizeObjectId';
import resolveAssetUrl from './media';
import { useUserCache } from '../contexts/UserCacheContext';
import { DEFAULT_AVATAR } from './feed';

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
    return DEFAULT_AVATAR;
  }

  const candidate =
    participant.avatar ||
    participant.avatarUrl ||
    participant.photoUrl ||
    participant.photoURL ||
    participant.profile?.avatar ||
    participant.profile?.photoUrl ||
    null;

  const resolved = resolveAssetUrl(candidate, { fallback: DEFAULT_AVATAR });
  return resolved || DEFAULT_AVATAR;
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
