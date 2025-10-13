const admin = require('firebase-admin');
const mongoose = require('mongoose');
const fs = require('fs');
const User = require('../models/User');

const USERNAME_MAX_LENGTH = 32;
const DEFAULT_USERNAME_PREFIX = 'user';

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

function normalizeEmail(email) {
  if (!email) {
    return undefined;
  }
  return email.trim().toLowerCase();
}

function extractProfileData(profile = {}) {
  const firebaseUid = profile.uid || profile.localId;
  const email = normalizeEmail(profile.email);
  const displayNameRaw = profile.displayName || profile.name || '';
  const displayName = displayNameRaw && displayNameRaw.trim().length > 0 ? displayNameRaw.trim() : undefined;

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

  if (user) {
    let changed = false;

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

    if (changed) {
      if (dryRun) {
        return { operation: origin === 'linked-by-email' ? 'would-link' : 'would-update', user: null };
      }

      await user.save();
      return { operation: origin === 'linked-by-email' ? 'linked' : 'updated', user };
    }

    return { operation: 'unchanged', user };
  }

  const username = await generateUniqueUsername(usernameSource);

  if (dryRun) {
    return { operation: 'would-create', user: null };
  }

  const createdUser = await User.create({
    firebaseUid,
    email,
    username,
    displayName: displayName || username,
    accountStatus: 'active'
  });

  return { operation: 'created', user: createdUser };
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
    errors: [],
    warnings: [],
    source: 'firebase-admin'
  };

  if (mongoose.connection.readyState === 0) {
    throw new Error('MongoDB connection not established before syncing users');
  }

  let authUsers;

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
      const { operation } = await upsertUserFromAuthProfile(authUser, { dryRun });
      switch (operation) {
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
        default:
          break;
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
