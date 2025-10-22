const admin = require('firebase-admin');
const mongoose = require('mongoose');
const fs = require('fs');
const User = require('../models/User');
const runtime = require('../config/runtime');

const USERNAME_MAX_LENGTH = 32;
const DEFAULT_USERNAME_PREFIX = 'user';

const PROFILE_IMAGE_COUNT =
  Number.parseInt(process.env.PINPOINT_PROFILE_IMAGE_COUNT ?? '12', 10) || 12;
const PROFILE_IMAGE_PATHS = Array.from({ length: PROFILE_IMAGE_COUNT }, (_, index) => {
  const padded = String(index + 1).padStart(2, '0');
  return `/images/profile/profile-${padded}.jpg`;
});

const hasProfileImages = PROFILE_IMAGE_PATHS.length > 0;

const resolveProfileImageBaseUrl = () => {
  const explicit = process.env.PINPOINT_PROFILE_IMAGE_BASE_URL;
  if (explicit && explicit.trim()) {
    return explicit.trim().replace(/\/+$/, '');
  }

  if (runtime.isOffline) {
    return 'http://localhost:5000';
  }

  const fallback = process.env.PINPOINT_PUBLIC_BASE_URL || process.env.VITE_API_BASE_URL;
  return fallback ? fallback.replace(/\/+$/, '') : null;
};

const PROFILE_IMAGE_BASE_URL = resolveProfileImageBaseUrl();
const shouldAssignFirebasePhotos = Boolean(PROFILE_IMAGE_BASE_URL && hasProfileImages);

const sanitizeUsername = (value) => {
  if (!value) {
    return DEFAULT_USERNAME_PREFIX;
  }

  const ascii = value
    .normalize('NFKD')
    .replace(/[^\w\d]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return ascii.length > 0 ? ascii : DEFAULT_USERNAME_PREFIX;
};

const trimForUsername = (value) => {
  if (value.length <= USERNAME_MAX_LENGTH) {
    return value;
  }

  return value.slice(0, USERNAME_MAX_LENGTH);
};

async function generateUniqueUsername(base) {
  const sanitizedBase = trimForUsername(sanitizeUsername(base));
  let candidate = sanitizedBase;
  let suffix = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Using exists avoids loading the full document
    // eslint-disable-next-line no-await-in-loop
    const exists = await User.exists({ username: candidate });
    if (!exists) {
      return candidate;
    }

    suffix += 1;
    const suffixText = `-${suffix}`;
    const trimmedBase = trimForUsername(
      sanitizedBase.slice(0, Math.max(1, USERNAME_MAX_LENGTH - suffixText.length))
    );
    candidate = `${trimmedBase}${suffixText}`;
  }
}

const normalizeEmail = (email) => {
  if (!email) {
    return undefined;
  }
  return email.trim().toLowerCase();
};

const extractProfileData = (profile = {}) => {
  const firebaseUid = profile.uid || profile.localId;
  const email = normalizeEmail(profile.email);
  const displayNameRaw = profile.displayName || profile.name || '';
  const displayName =
    displayNameRaw && displayNameRaw.trim().length > 0 ? displayNameRaw.trim() : undefined;

  let usernameSource = displayName;
  if (!usernameSource && email) {
    usernameSource = email.split('@')[0];
  }
  if (!usernameSource && firebaseUid) {
    usernameSource = `${DEFAULT_USERNAME_PREFIX}-${firebaseUid}`.slice(0, USERNAME_MAX_LENGTH);
  }

  return {
    firebaseUid,
    email,
    displayName,
    usernameSource: usernameSource || DEFAULT_USERNAME_PREFIX
  };
};

const computeProfileImageIndex = (uid) => {
  if (!uid || PROFILE_IMAGE_PATHS.length === 0) {
    return 0;
  }
  let hash = 0;
  for (let index = 0; index < uid.length; index += 1) {
    hash = (hash + uid.charCodeAt(index)) % PROFILE_IMAGE_PATHS.length;
  }
  return hash;
};

const resolveProfileImageRelativePath = (uid) => {
  if (!hasProfileImages) {
    return null;
  }
  const index = computeProfileImageIndex(uid);
  return PROFILE_IMAGE_PATHS[index] ?? PROFILE_IMAGE_PATHS[0] ?? null;
};

const resolveProfilePhotoUrl = (uid) => {
  if (!shouldAssignFirebasePhotos) {
    return null;
  }
  const relativePath = resolveProfileImageRelativePath(uid);
  if (!relativePath) {
    return null;
  }
  return `${PROFILE_IMAGE_BASE_URL}${relativePath}`;
};

if (!hasProfileImages) {
  console.warn(
    'No default profile images found. Set PINPOINT_PROFILE_IMAGE_COUNT or ensure uploaded images are available.'
  );
} else if (!shouldAssignFirebasePhotos) {
  console.warn(
    'Firebase profile photo assignment disabled. Provide PINPOINT_PROFILE_IMAGE_BASE_URL or run in offline mode to enable default avatars.'
  );
}

async function upsertUserFromAuthProfile(profile, { dryRun = false } = {}) {
  const { firebaseUid, email, displayName, usernameSource } = extractProfileData(profile);

  if (!firebaseUid) {
    throw new Error('Firebase auth profile is missing a uid');
  }

  let user = await User.findOne({ firebaseUid });
  let origin = 'existing';

  if (!user && email) {
    user = await User.findOne({ email });
    if (user) {
      origin = 'linked-by-email';
    }
  }

  const targetRelativeAvatarPath = resolveProfileImageRelativePath(firebaseUid);

  if (user) {
    let changed = false;
    let avatarSet = false;

    if (!user.firebaseUid) {
      user.firebaseUid = firebaseUid;
      changed = true;
    }

    if (email && !user.email) {
      user.email = email;
      changed = true;
    }

    if (displayName && !user.displayName) {
      user.displayName = displayName;
      changed = true;
    }

    if (targetRelativeAvatarPath && (!user.avatar || !user.avatar.url)) {
      user.avatar = {
        url: targetRelativeAvatarPath,
        thumbnailUrl: targetRelativeAvatarPath
      };
      changed = true;
      avatarSet = true;
    }

    if (changed) {
      if (dryRun) {
        return {
          operation: origin === 'linked-by-email' ? 'would-link' : 'would-update',
          user: null,
          avatarSet
        };
      }

      await user.save();
      return {
        operation: origin === 'linked-by-email' ? 'linked' : 'updated',
        user,
        avatarSet
      };
    }

    return { operation: 'unchanged', user, avatarSet: false };
  }

  const username = await generateUniqueUsername(usernameSource);
  const avatar =
    targetRelativeAvatarPath && !dryRun
      ? {
          url: targetRelativeAvatarPath,
          thumbnailUrl: targetRelativeAvatarPath
        }
      : undefined;

  if (dryRun) {
    return { operation: 'would-create', user: null, avatarSet: Boolean(targetRelativeAvatarPath) };
  }

  const createdUser = await User.create({
    firebaseUid,
    email,
    username,
    displayName: displayName || username,
    accountStatus: 'active',
    ...(avatar ? { avatar } : {})
  });

  return { operation: 'created', user: createdUser, avatarSet: Boolean(avatar) };
}

async function ensureUserForFirebaseAccount(decodedToken) {
  if (!decodedToken) {
    return null;
  }

  const { user } = await upsertUserFromAuthProfile(decodedToken);
  return user;
}

function loadUsersFromExport(exportPath) {
  if (!exportPath) {
    throw new Error('No fallback export path provided');
  }

  if (!fs.existsSync(exportPath)) {
    throw new Error(`Firebase Auth export not found at ${exportPath}`);
  }

  const raw = fs.readFileSync(exportPath, 'utf8');
  const data = JSON.parse(raw);
  const users = Array.isArray(data.users) ? data.users : [];

  return users.map((user) => ({
    uid: user.localId,
    localId: user.localId,
    email: user.email,
    displayName: user.displayName,
    providerData: user.providerUserInfo || []
  }));
}

async function fetchAllAuthUsersViaAdmin() {
  const collected = [];
  let pageToken;

  do {
    // eslint-disable-next-line no-await-in-loop
    const result = await admin.auth().listUsers(1000, pageToken);
    collected.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);

  return collected;
}

async function syncAllFirebaseUsers({ dryRun = false, fallbackExportPath } = {}) {
  const summary = {
    created: 0,
    linked: 0,
    updated: 0,
    unchanged: 0,
    photoUpdated: 0,
    mongoAvatarUpdated: 0,
    errors: [],
    warnings: [],
    source: 'firebase-admin'
  };

  if (mongoose.connection.readyState === 0) {
    throw new Error('MongoDB connection not established before syncing users');
  }

  let authUsers;
  let photoSyncDisabled = false;
  let photoSyncDisabledReason = null;

  try {
    authUsers = await fetchAllAuthUsersViaAdmin();
  } catch (error) {
    if (!fallbackExportPath) {
      throw error;
    }

    summary.warnings.push({
      type: 'firebase-admin',
      message: error.message || 'Failed to list users via Firebase Admin SDK'
    });

    try {
      authUsers = loadUsersFromExport(fallbackExportPath);
      summary.source = 'emulator-export';
    } catch (fallbackError) {
      throw fallbackError;
    }
  }

  for (const authUser of authUsers) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const { operation, user, avatarSet } = await upsertUserFromAuthProfile(authUser, { dryRun });
      switch (operation) {
        case 'created':
        case 'would-create':
          summary.created += 1;
          break;
        case 'linked':
        case 'would-link':
          summary.linked += 1;
          break;
        case 'updated':
        case 'would-update':
          summary.updated += 1;
          break;
        case 'unchanged':
          summary.unchanged += 1;
          break;
        default:
          break;
      }

      if (avatarSet && !dryRun) {
        summary.mongoAvatarUpdated += 1;
      }

      if (shouldAssignFirebasePhotos && authUser?.uid) {
        if (photoSyncDisabled) {
          continue;
        }

        const targetPhotoUrl = resolveProfilePhotoUrl(authUser.uid);
        if (targetPhotoUrl && authUser.photoURL !== targetPhotoUrl) {
          try {
            if (!dryRun) {
              // eslint-disable-next-line no-await-in-loop
              await admin.auth().updateUser(authUser.uid, { photoURL: targetPhotoUrl });
            }
            summary.photoUpdated += 1;
          } catch (error) {
            const message = error?.message || 'Failed to update photo URL';
            const isConnectionRefused =
              error?.code === 'ECONNREFUSED' ||
              (typeof message === 'string' && message.includes('ECONNREFUSED'));

            if (runtime.isOffline && isConnectionRefused) {
              photoSyncDisabled = true;
              photoSyncDisabledReason =
                photoSyncDisabledReason ||
                `Auth emulator not reachable at ${
                  process.env.FIREBASE_AUTH_EMULATOR_HOST || runtime.firebase.emulatorHost
                }`;

              summary.warnings.push({
                type: 'photo-sync-disabled',
                uid: authUser.uid,
                message: `${photoSyncDisabledReason}. Skipping further Firebase photo updates.`
              });
            } else {
              summary.warnings.push({
                type: 'photo-update',
                uid: authUser.uid,
                message
              });
            }
          }
        }
      }
    } catch (error) {
      summary.errors.push({ uid: authUser.uid || authUser.localId, message: error.message });
    }
  }

  return summary;
}

module.exports = {
  ensureUserForFirebaseAccount,
  syncAllFirebaseUsers,
  upsertUserFromAuthProfile
};
