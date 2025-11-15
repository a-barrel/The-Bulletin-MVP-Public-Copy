const admin = require('firebase-admin');
const mongoose = require('mongoose');
const fs = require('fs');
const User = require('../models/User');
const runtime = require('../config/runtime');
const { toIdString } = require('../utils/ids');

const USERNAME_MAX_LENGTH = 32;
const DEFAULT_USERNAME_PREFIX = 'user';
const DEFAULT_SAMPLE_PASSWORD = 'Pinpoint123!';

const resolveProfileImageExtension = () => {
  const configured = process.env.PINPOINT_PROFILE_IMAGE_EXTENSION;
  if (configured && configured.trim()) {
    return configured.trim().replace(/^\.+/, '').toLowerCase();
  }
  return 'jpg';
};

const PROFILE_IMAGE_EXTENSION = resolveProfileImageExtension();

const PROFILE_IMAGE_COUNT =
  Number.parseInt(process.env.PINPOINT_PROFILE_IMAGE_COUNT ?? '10', 10) || 10;
const PROFILE_IMAGE_PATHS = Array.from({ length: PROFILE_IMAGE_COUNT }, (_, index) => {
  const padded = String(index + 1).padStart(2, '0');
  return `/images/profile/profile-${padded}.${PROFILE_IMAGE_EXTENSION}`;
});

const hasProfileImages = PROFILE_IMAGE_PATHS.length > 0;

const resolveProfileImageBaseUrl = () => {
  const explicit = process.env.PINPOINT_PROFILE_IMAGE_BASE_URL;
  if (explicit && explicit.trim()) {
    return explicit.trim().replace(/\/+$/, '');
  }

  if (runtime.isOffline) {
    return 'http://localhost:8000';
  }

  const fallback = process.env.PINPOINT_PUBLIC_BASE_URL || process.env.VITE_API_BASE_URL;
  return fallback ? fallback.replace(/\/+$/, '') : null;
};

const firebasePhotoSyncEnabled = process.env.PINPOINT_ENABLE_FIREBASE_PHOTO_SYNC === 'true';
const PROFILE_IMAGE_BASE_URL = resolveProfileImageBaseUrl();
const shouldAssignFirebasePhotos = Boolean(
  firebasePhotoSyncEnabled && PROFILE_IMAGE_BASE_URL && hasProfileImages
);

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
} else if (!firebasePhotoSyncEnabled) {
  console.info(
    'Firebase profile photo synchronization disabled. Set PINPOINT_ENABLE_FIREBASE_PHOTO_SYNC=true to enable updating Firebase avatars.'
  );
} else if (!PROFILE_IMAGE_BASE_URL) {
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

    const hasExistingAvatar = Boolean(
      user.avatar && (user.avatar.url || user.avatar.thumbnailUrl || user.avatar.path)
    );

    if (targetRelativeAvatarPath && !hasExistingAvatar) {
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

  if (dryRun) {
    return { operation: 'would-create', user: null, avatarSet: Boolean(targetRelativeAvatarPath) };
  }

  const MAX_CREATE_ATTEMPTS = 5;
  let lastDuplicateError = null;

  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
    const username = await generateUniqueUsername(usernameSource);
    const avatar =
      targetRelativeAvatarPath
        ? {
            url: targetRelativeAvatarPath,
            thumbnailUrl: targetRelativeAvatarPath
          }
        : undefined;

    try {
      const createdUser = await User.create({
        firebaseUid,
        email,
        username,
        displayName: displayName || username,
        accountStatus: 'active',
        ...(avatar ? { avatar } : {})
      });

      return { operation: 'created', user: createdUser, avatarSet: Boolean(avatar) };
    } catch (error) {
      if (error?.code === 11000) {
        const duplicatedFields = Object.keys(error?.keyPattern || {});
        const duplicateFirebaseUid =
          duplicatedFields.includes('firebaseUid') ||
          /firebaseUid/i.test(error?.message || '') ||
          /firebaseuid/i.test(JSON.stringify(error?.keyValue || {}));

        if (duplicateFirebaseUid) {
          const existingUser = await User.findOne({ firebaseUid });
          if (existingUser) {
            return { operation: 'linked', user: existingUser, avatarSet: false };
          }
        }

        lastDuplicateError = error;
        // Retry with a new username candidate if we collided on username or another unique field.
        // eslint-disable-next-line no-continue
        continue;
      }

      throw error;
    }
  }

  if (lastDuplicateError) {
    throw lastDuplicateError;
  }

  throw new Error('Failed to create user after repeated duplicate key errors');
}

async function ensureUserForFirebaseAccount(decodedToken) {
  if (!decodedToken) {
    return null;
  }

  const { user } = await upsertUserFromAuthProfile(decodedToken);
  return user;
}

const resolveDefaultSamplePassword = () =>
  (process.env.PINPOINT_SAMPLE_ACCOUNT_PASSWORD &&
  process.env.PINPOINT_SAMPLE_ACCOUNT_PASSWORD.trim().length >= 6
    ? process.env.PINPOINT_SAMPLE_ACCOUNT_PASSWORD.trim()
    : DEFAULT_SAMPLE_PASSWORD);

const buildFallbackEmailForUser = (user) => {
  const idText = toIdString(user?._id) || sanitizeUsername(user?.username || user?.displayName || 'user');
  return `user-${idText}@pinpoint.local`;
};

async function ensureFirebaseAccountForUserDocument(user, { dryRun = false, defaultPassword } = {}) {
  if (!user) {
    return { status: 'skipped', reason: 'missing-user' };
  }

  const summary = {
    status: 'skipped',
    userId: toIdString(user._id),
    username: user.username,
    email: null,
    firebaseUid: user.firebaseUid || null,
    createdAuthUser: false,
    updatedAuthUser: false,
    mongoUpdated: false,
    warnings: []
  };

  const hadFirebaseUid = Boolean(user.firebaseUid);

  let authUser = null;
  let targetEmail = normalizeEmail(user.email) || buildFallbackEmailForUser(user);
  summary.email = targetEmail;

  try {
    if (user.firebaseUid) {
      authUser = await admin.auth().getUser(user.firebaseUid);
    }
  } catch (error) {
    if (error && error.code === 'auth/user-not-found') {
      summary.warnings.push({
        type: 'missing-firebase-user',
        message: `Firebase user ${user.firebaseUid} not found. Recreating.`,
        firebaseUid: user.firebaseUid
      });
      authUser = null;
    } else {
      throw error;
    }
  }

  if (!authUser && targetEmail) {
    try {
      authUser = await admin.auth().getUserByEmail(targetEmail);
    } catch (error) {
      if (!error || error.code !== 'auth/user-not-found') {
        throw error;
      }
    }
  }

  const displayName =
    (user.displayName && user.displayName.trim()) ||
    (user.username && user.username.trim()) ||
    (targetEmail && targetEmail.split('@')[0]) ||
    'Pinpoint User';

  const accountDisabled = Boolean(user.accountStatus && user.accountStatus !== 'active');
  const password = defaultPassword || resolveDefaultSamplePassword();

  if (!authUser) {
    if (dryRun) {
      summary.status = 'would-create';
      return summary;
    }

    const createPayload = {
      email: targetEmail,
      password,
      displayName,
      emailVerified: Boolean(targetEmail),
      disabled: accountDisabled
    };
    if (user.firebaseUid) {
      createPayload.uid = user.firebaseUid;
    }
    authUser = await admin.auth().createUser(createPayload);
    summary.createdAuthUser = true;

    if (shouldAssignFirebasePhotos) {
      const targetPhotoUrl = resolveProfilePhotoUrl(authUser.uid);
      if (targetPhotoUrl && authUser.photoURL !== targetPhotoUrl) {
        await admin.auth().updateUser(authUser.uid, { photoURL: targetPhotoUrl });
        summary.updatedAuthUser = true;
      }
    }
  } else {
    const updatePayload = {};

    if (targetEmail && authUser.email !== targetEmail) {
      updatePayload.email = targetEmail;
      updatePayload.emailVerified = true;
    } else if (targetEmail && !authUser.emailVerified) {
      updatePayload.emailVerified = true;
    }

    if (authUser.displayName !== displayName) {
      updatePayload.displayName = displayName;
    }

    if (accountDisabled !== authUser.disabled) {
      updatePayload.disabled = accountDisabled;
    }

    if (shouldAssignFirebasePhotos) {
      const targetPhotoUrl = resolveProfilePhotoUrl(authUser.uid);
      if (targetPhotoUrl && authUser.photoURL !== targetPhotoUrl) {
        updatePayload.photoURL = targetPhotoUrl;
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      if (!dryRun) {
        await admin.auth().updateUser(authUser.uid, updatePayload);
      }
      summary.updatedAuthUser = true;
    }
  }

  summary.firebaseUid = authUser.uid;

  let mongoChanged = false;
  if (!user.firebaseUid || user.firebaseUid !== authUser.uid) {
    user.firebaseUid = authUser.uid;
    mongoChanged = true;
  }
  if (!user.email && targetEmail) {
    user.email = targetEmail;
    mongoChanged = true;
  }
  if (!user.displayName && displayName) {
    user.displayName = displayName;
    mongoChanged = true;
  }

  if (mongoChanged) {
    if (!dryRun) {
      await user.save();
    }
    summary.mongoUpdated = true;
  }

  if (summary.createdAuthUser) {
    summary.status = 'created';
  } else if (!hadFirebaseUid && summary.mongoUpdated) {
    summary.status = 'linked';
  } else if (summary.updatedAuthUser || summary.mongoUpdated) {
    summary.status = 'updated';
  } else {
    summary.status = 'unchanged';
  }

  return summary;
}

async function provisionFirebaseAccountsForAllUsers({ dryRun = false, defaultPassword } = {}) {
  const summary = {
    processed: 0,
    created: 0,
    linked: 0,
    updated: 0,
    unchanged: 0,
    wouldCreate: 0,
    skipped: 0,
    errors: [],
    warnings: []
  };

  const cursor = User.find().cursor();

  // eslint-disable-next-line no-restricted-syntax
  for await (const user of cursor) {
    summary.processed += 1;
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await ensureFirebaseAccountForUserDocument(user, { dryRun, defaultPassword });
      summary.warnings.push(...(result.warnings || []));

      switch (result.status) {
        case 'created':
          summary.created += 1;
          break;
        case 'linked':
          summary.linked += 1;
          break;
        case 'updated':
          summary.updated += 1;
          break;
        case 'unchanged':
          summary.unchanged += 1;
          break;
        case 'would-create':
          summary.wouldCreate += 1;
          break;
        case 'skipped':
          summary.skipped += 1;
          break;
        default:
          break;
      }
    } catch (error) {
      summary.errors.push({
        userId: toIdString(user._id),
        username: user.username,
        message: error?.message || 'Failed to ensure Firebase account for user'
      });
    }
  }

  return summary;
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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const DEFAULT_AUTH_FETCH_RETRY_ATTEMPTS = 7;
const DEFAULT_AUTH_FETCH_RETRY_DELAY_MS = 500;

async function fetchAllAuthUsersViaAdmin({
  maxAttempts = runtime.isOffline ? DEFAULT_AUTH_FETCH_RETRY_ATTEMPTS : 1,
  baseDelayMs = DEFAULT_AUTH_FETCH_RETRY_DELAY_MS
} = {}) {
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      const collected = [];
      let pageToken;

      do {
        // eslint-disable-next-line no-await-in-loop
        const result = await admin.auth().listUsers(1000, pageToken);
        collected.push(...result.users);
        pageToken = result.pageToken;
      } while (pageToken);

      return collected;
    } catch (error) {
      const message = error?.message || '';
      const isConnectionRefused =
        error?.code === 'ECONNREFUSED' ||
        (typeof message === 'string' && message.includes('ECONNREFUSED'));

      const isRetryable = runtime.isOffline && isConnectionRefused && attempt < maxAttempts - 1;
      if (!isRetryable) {
        throw error;
      }

      const backoffMs = Math.min(baseDelayMs * 2 ** attempt, 5000);
      console.info(
        `Firebase Auth emulator not ready (attempt ${attempt + 1}/${maxAttempts}). Retrying in ${backoffMs}ms.`
      );
      // eslint-disable-next-line no-await-in-loop
      await wait(backoffMs);
      attempt += 1;
    }
  }

  // Should never reach here because we either return or throw.
  return [];
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

    const errorMessage = error?.message || 'Failed to list users via Firebase Admin SDK';
    const isConnectionRefused =
      error?.code === 'ECONNREFUSED' ||
      (typeof errorMessage === 'string' && errorMessage.includes('ECONNREFUSED'));

    if (!(runtime.isOffline && isConnectionRefused)) {
      summary.warnings.push({
        type: 'firebase-admin',
        message: errorMessage
      });
    } else {
      console.info(
        `Firebase Auth emulator not reachable (${errorMessage}). Falling back to local export for user sync.`
      );
    }

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
  upsertUserFromAuthProfile,
  ensureFirebaseAccountForUserDocument,
  provisionFirebaseAccountsForAllUsers
};
