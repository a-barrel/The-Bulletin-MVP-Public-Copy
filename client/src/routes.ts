const ensureString = (value: string | number) => String(value);

const encodeSegment = (value: string | number) =>
  encodeURIComponent(ensureString(value));

export const routes = {
  root: '/',
  auth: {
    login: '/login',
    register: '/register',
    forgotPassword: '/forgot-password',
    resetPassword: '/reset-password'
  },
  profile: {
    base: '/profile',
    me: '/profile/me',
    byId: (userId: string | number) => `/profile/${encodeSegment(userId)}`
  },
  profileDebug: {
    base: '/profile-debug',
    me: '/profile-debug/me',
    byId: (userId: string | number) => `/profile-debug/${encodeSegment(userId)}`
  },
  settings: {
    base: '/settings'
  },
  bookmarks: {
    base: '/bookmarks',
    collection: (collectionId: string | number) =>
      `/bookmarks?collection=${encodeSegment(collectionId)}`
  },
  updates: {
    base: '/updates'
  },
  admin: {
    base: '/admin'
  },
  directMessages: {
    base: '/chat?tab=direct',
    thread: (threadId: string | number) => `/chat?tab=direct&thread=${encodeSegment(threadId)}`
  },
  list: {
    base: '/list'
  },
  map: {
    base: '/map'
  },
  chat: {
    base: '/chat'
  },
  createPin: {
    base: '/create-pin'
  },
  logout: {
    base: '/logout'
  },
  pin: {
    base: '/pin',
    byId: (pinId: string | number) => `/pin/${encodeSegment(pinId)}`
  },
  pinV2: {
    base: '/pin-v2',
    byId: (pinId: string | number) => `/pin-v2/${encodeSegment(pinId)}`
  },
  notFound: {
    base: '/not-found'
  }
} as const;

export type Routes = typeof routes;

export default routes;
