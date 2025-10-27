const mongoose = require('mongoose');

const mockAuth = {
  getUser: jest.fn().mockRejectedValue(Object.assign(new Error('not found'), { code: 'auth/user-not-found' })),
  getUserByEmail: jest.fn().mockRejectedValue(Object.assign(new Error('not found'), { code: 'auth/user-not-found' })),
  createUser: jest.fn().mockResolvedValue({ uid: 'firebase-uid', photoURL: null }),
  updateUser: jest.fn().mockResolvedValue()
};

jest.mock('firebase-admin', () => ({
  auth: jest.fn(() => mockAuth)
}));

const { ensureFirebaseAccountForUserDocument } = require('../../services/firebaseUserSync');

describe('firebaseUserSync ensureFirebaseAccountForUserDocument', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.getUser.mockRejectedValue(Object.assign(new Error('not found'), { code: 'auth/user-not-found' }));
    mockAuth.getUserByEmail.mockRejectedValue(Object.assign(new Error('not found'), { code: 'auth/user-not-found' }));
    mockAuth.createUser.mockResolvedValue({ uid: 'firebase-uid', photoURL: null });
  });

  it('creates firebase user with fallback email and updates mongo user', async () => {
    const userDoc = {
      _id: new mongoose.Types.ObjectId(),
      username: 'alexrivera',
      displayName: null,
      email: null,
      firebaseUid: null,
      save: jest.fn().mockResolvedValue(undefined)
    };

    const result = await ensureFirebaseAccountForUserDocument(userDoc, {
      defaultPassword: 'SamplePass1!'
    });

    expect(mockAuth.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: expect.stringMatching(/^user-[a-f0-9]{24}@pinpoint\.local$/),
        password: 'SamplePass1!'
      })
    );
    expect(userDoc.firebaseUid).toBe('firebase-uid');
    expect(userDoc.email).toMatch(/^user-[a-f0-9]{24}@pinpoint\.local$/);
    expect(userDoc.displayName).toBeDefined();
    expect(userDoc.save).toHaveBeenCalled();
    expect(result.status).toBe('created');
  });

  it('returns dry-run status without mutating user when dryRun option is set', async () => {
    const userDoc = {
      _id: new mongoose.Types.ObjectId(),
      username: 'alexrivera',
      displayName: null,
      email: null,
      firebaseUid: null,
      save: jest.fn()
    };

    const result = await ensureFirebaseAccountForUserDocument(userDoc, {
      dryRun: true
    });

    expect(mockAuth.createUser).not.toHaveBeenCalled();
    expect(userDoc.save).not.toHaveBeenCalled();
    expect(result.status).toBe('would-create');
  });
});
