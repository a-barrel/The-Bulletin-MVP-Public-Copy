import runtimeConfig from '../config/runtime';

const BADGE_SOUND_URL = (() => {
  const configuredBase = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
  if (configuredBase) {
    return `${configuredBase}/sounds/badge_obtained.mp3`.replace(/([^:]\/)\/+/g, '$1');
  }

  if (typeof window !== 'undefined') {
    const { origin } = window.location;
    return `${origin}/sounds/badge_obtained.mp3`.replace(/([^:]\/)\/+/g, '$1');
  }

  return '/sounds/badge_obtained.mp3';
})();

const DEFAULT_VOLUME = 0.85;

let badgeAudio = null;
let resumeListenersAttached = false;
let isBadgeAudioUnlocked = false;
let pendingUnlockPromise = null;
let globalUnlockListenersAttached = false;
let badgeSoundEnabled = false;

const getBadgeAudio = () => {
  if (!badgeAudio) {
    badgeAudio = new Audio(BADGE_SOUND_URL);
    badgeAudio.preload = 'auto';
    badgeAudio.volume = DEFAULT_VOLUME;
  }
  return badgeAudio;
};

const resetAudioState = (audio, { volume, muted }) => {
  audio.pause();
  audio.currentTime = 0;
  audio.volume = volume;
  audio.muted = muted;
};

const attemptUnlockBadgeAudio = () => {
  if (isBadgeAudioUnlocked) {
    return Promise.resolve();
  }
  if (pendingUnlockPromise) {
    return pendingUnlockPromise;
  }

  try {
    const audio = getBadgeAudio();
    const original = { volume: audio.volume, muted: audio.muted };
    audio.muted = false;
    audio.volume = 0;

    const playResult = audio.play();

    if (playResult && typeof playResult.then === 'function') {
      pendingUnlockPromise = playResult
        .then(() => {
          resetAudioState(audio, original);
          isBadgeAudioUnlocked = true;
          pendingUnlockPromise = null;
        })
        .catch((error) => {
          resetAudioState(audio, original);
          pendingUnlockPromise = null;
          throw error;
        });
      return pendingUnlockPromise;
    }

    resetAudioState(audio, original);
    isBadgeAudioUnlocked = true;
    return Promise.resolve();
  } catch (error) {
    pendingUnlockPromise = null;
    return Promise.reject(error);
  }
};

const detachGlobalUnlockListeners = () => {
  if (!globalUnlockListenersAttached || typeof window === 'undefined') {
    return;
  }
  window.removeEventListener('pointerdown', handleFirstUserInteraction, { capture: true });
  window.removeEventListener('keydown', handleFirstUserInteraction, { capture: true });
  globalUnlockListenersAttached = false;
};

function handleFirstUserInteraction() {
  attemptUnlockBadgeAudio()
    .then(() => {
      if (isBadgeAudioUnlocked) {
        detachGlobalUnlockListeners();
      }
    })
    .catch((error) => {
      if (error?.name !== 'NotAllowedError') {
        console.warn('Failed to unlock badge audio:', error);
      }
    });
}

function ensureGlobalUnlockListeners() {
  if (typeof window === 'undefined' || globalUnlockListenersAttached) {
    return;
  }
  window.addEventListener('pointerdown', handleFirstUserInteraction, { capture: true, passive: true });
  window.addEventListener('keydown', handleFirstUserInteraction, { capture: true });
  globalUnlockListenersAttached = true;
}

if (typeof window !== 'undefined') {
  ensureGlobalUnlockListeners();
}

const attachResumeListeners = () => {
  if (resumeListenersAttached || typeof window === 'undefined') {
    return;
  }
  const resume = () => {
    const audio = getBadgeAudio();
    audio.currentTime = 0;
    audio.play().catch(() => {});
    window.removeEventListener('pointerdown', resume);
    window.removeEventListener('keydown', resume);
    resumeListenersAttached = false;
  };
  window.addEventListener('pointerdown', resume, { once: true });
  window.addEventListener('keydown', resume, { once: true });
  resumeListenersAttached = true;
};

export const preloadBadgeSound = () => {
  if (!badgeSoundEnabled) {
    return;
  }
  ensureGlobalUnlockListeners();
  const audio = getBadgeAudio();
  audio.load();
};

export const playBadgeSound = () => {
  try {
    if (!badgeSoundEnabled) {
      return;
    }
    ensureGlobalUnlockListeners();
    if (!isBadgeAudioUnlocked) {
      attemptUnlockBadgeAudio().catch(() => {});
    }
    const audio = getBadgeAudio();
    audio.pause();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.catch((error) => {
        if (error?.name === 'NotAllowedError') {
          attachResumeListeners();
        }
      });
    }
  } catch (error) {
    console.warn('Failed to play badge sound:', error);
  }
};

export const isBadgeSoundEnabled = () => badgeSoundEnabled;

export const setBadgeSoundEnabled = (enabled) => {
  const next = Boolean(enabled);
  badgeSoundEnabled = next;

  if (!next && badgeAudio) {
    try {
      badgeAudio.pause();
      badgeAudio.currentTime = 0;
    } catch {
      // ignore
    }
  }

  if (next) {
    ensureGlobalUnlockListeners();
  }
};
