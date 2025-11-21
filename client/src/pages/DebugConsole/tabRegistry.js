import { lazy } from 'react';
import {
  ACCOUNT_SWAP_TAB_ID,
  CHAT_VIS_TAB_ID,
  EXPERIMENT_ENABLED,
  EXPERIMENT_TAB_ID,
  EXPERIMENT_TITLE,
  LIVE_CHAT_TAB_ID,
  STORAGE_TAB_ID
} from './constants';

const PinsTab = lazy(() => import('./tabs/PinsTab'));
const ProfilesTab = lazy(() => import('./tabs/ProfilesTab'));
const LocationsTab = lazy(() => import('./tabs/LocationsTab'));
const BookmarksTab = lazy(() => import('./tabs/BookmarksTab'));
const BadgesTab = lazy(() => import('./tabs/BadgesTab'));
const ChatTab = lazy(() => import('./tabs/ChatTab'));
const LiveChatTestTab = lazy(() =>
  import(/* webpackChunkName: "debug-live-chat" */ './tabs/LiveChatTestTab')
);
const ChatRoomVisualizationTab = lazy(() =>
  import(/* webpackChunkName: "debug-chat-vis" */ './tabs/ChatRoomVisualizationTab')
);
const UpdatesTab = lazy(() => import('./tabs/UpdatesTab'));
const FirebaseStorageTab = lazy(() =>
  import(/* webpackChunkName: "debug-storage" */ './tabs/FirebaseStorageTab')
);
const SystemTab = lazy(() => import('./tabs/SystemTab'));
const BadUsersTab = lazy(() => import('./tabs/BadUsersTab'));
const ModerationTab = lazy(() => import('./tabs/ModerationTab'));
const FriendsTab = lazy(() => import('./tabs/FriendsTab'));
const DirectMessagesTab = lazy(() => import('./tabs/DirectMessagesTab'));
const RepliesTab = lazy(() => import('./tabs/RepliesTab'));
const AccountSwapTab = lazy(() => import('./tabs/AccountSwapTab'));
const ExperimentTab = lazy(() => import('./tabs/ExperimentTab'));
const RolesTab = lazy(() => import('./tabs/RolesTab'));
const PopularLocationsTab = lazy(() => import('./tabs/PopularLocationsTab'));

const HEAVY_TAB_FALLBACKS = {
  [LIVE_CHAT_TAB_ID]: 'Loading live chat tools…',
  [CHAT_VIS_TAB_ID]: 'Spinning up chat room visualization…',
  [STORAGE_TAB_ID]: 'Loading storage explorer…'
};

const BASE_TABS = [
  { id: 'pin', label: 'Pins & Events', Component: PinsTab },
  { id: 'profile', label: 'Profiles', Component: ProfilesTab },
  { id: 'locations', label: 'Locations', Component: LocationsTab },
  { id: 'bookmarks', label: 'Bookmarks', Component: BookmarksTab },
  { id: 'badges', label: 'Badges', Component: BadgesTab },
  { id: 'chat', label: 'Chat', Component: ChatTab },
  {
    id: LIVE_CHAT_TAB_ID,
    label: 'Live Chat Test',
    Component: LiveChatTestTab,
    fallback: HEAVY_TAB_FALLBACKS[LIVE_CHAT_TAB_ID]
  },
  {
    id: CHAT_VIS_TAB_ID,
    label: 'Chat Room Visualization',
    Component: ChatRoomVisualizationTab,
    fallback: HEAVY_TAB_FALLBACKS[CHAT_VIS_TAB_ID]
  },
  { id: 'updates', label: 'Updates', Component: UpdatesTab },
  {
    id: STORAGE_TAB_ID,
    label: 'Storage Explorer',
    Component: FirebaseStorageTab,
    fallback: HEAVY_TAB_FALLBACKS[STORAGE_TAB_ID]
  },
  { id: 'system', label: 'System Tools', Component: SystemTab },
  { id: 'bad-users', label: 'BAD USERS >:(', Component: BadUsersTab },
  { id: 'moderation', label: 'Moderation', Component: ModerationTab },
  { id: 'friends', label: 'Friends', Component: FriendsTab },
  { id: 'direct-messages', label: 'Direct Messages', Component: DirectMessagesTab },
  { id: 'replies', label: 'Replies', Component: RepliesTab },
  { id: 'roles', label: 'Roles', Component: RolesTab },
  { id: 'popular-locations', label: 'Popular Locations', Component: PopularLocationsTab },
  { id: ACCOUNT_SWAP_TAB_ID, label: 'Account Swap', Component: AccountSwapTab }
];

export const TAB_DEFINITIONS = EXPERIMENT_ENABLED
  ? [
      ...BASE_TABS,
      { id: EXPERIMENT_TAB_ID, label: EXPERIMENT_TITLE, Component: ExperimentTab }
    ]
  : BASE_TABS;

export default TAB_DEFINITIONS;
