import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { awardBadge } from '../../api/mongoDataApi';
import { playBadgeSound } from '../../utils/badgeSound';
import { useBadgeSound } from '../../contexts/BadgeSoundContext';
import {
  ACCOUNT_SWAP_TAB_ID,
  CHAT_VIS_TAB_ID,
  EXPERIMENT_ENABLED,
  EXPERIMENT_TAB_ID,
  EXPERIMENT_TITLE,
  LIVE_CHAT_TAB_ID,
  STORAGE_TAB_ID,
  pageConfig
} from './constants';
import PinsTab from './tabs/PinsTab';
import ProfilesTab from './tabs/ProfilesTab';
import LocationsTab from './tabs/LocationsTab';
import BookmarksTab from './tabs/BookmarksTab';
import BadgesTab from './tabs/BadgesTab';
import ChatTab from './tabs/ChatTab';
import LiveChatTestTab from './tabs/LiveChatTestTab';
import ChatRoomVisualizationTab from './tabs/ChatRoomVisualizationTab';
import UpdatesTab from './tabs/UpdatesTab';
import BadUsersTab from './tabs/BadUsersTab';
import RepliesTab from './tabs/RepliesTab';
import AccountSwapTab from './tabs/AccountSwapTab';
import ExperimentTab from './tabs/ExperimentTab';
import FirebaseStorageTab from './tabs/FirebaseStorageTab';

const BASE_TABS = [
  { id: 'pin', label: 'Pins & Events', Component: PinsTab },
  { id: 'profile', label: 'Profiles', Component: ProfilesTab },
  { id: 'locations', label: 'Locations', Component: LocationsTab },
  { id: 'bookmarks', label: 'Bookmarks', Component: BookmarksTab },
  { id: 'badges', label: 'Badges', Component: BadgesTab },
  { id: 'chat', label: 'Chat', Component: ChatTab },
  { id: LIVE_CHAT_TAB_ID, label: 'Live Chat Test', Component: LiveChatTestTab },
  { id: CHAT_VIS_TAB_ID, label: 'Chat Room Visualization', Component: ChatRoomVisualizationTab },
  { id: 'updates', label: 'Updates', Component: UpdatesTab },
  { id: STORAGE_TAB_ID, label: 'Storage Explorer', Component: FirebaseStorageTab },
  { id: 'bad-users', label: 'BAD USERS >:(', Component: BadUsersTab },
  { id: 'replies', label: 'Replies', Component: RepliesTab },
  { id: ACCOUNT_SWAP_TAB_ID, label: 'Account Swap', Component: AccountSwapTab }
];

const TAB_DEFINITIONS = EXPERIMENT_ENABLED
  ? [
      ...BASE_TABS,
      { id: EXPERIMENT_TAB_ID, label: EXPERIMENT_TITLE, Component: ExperimentTab }
    ]
  : BASE_TABS;

export function DebugConsolePage() {
  const [activeTabId, setActiveTabId] = useState(TAB_DEFINITIONS[0]?.id ?? 'pin');
  const { announceBadgeEarned } = useBadgeSound();

  useEffect(() => {
    awardBadge('enter-debug-console')
      .then((result) => {
        if (result?.granted) {
          playBadgeSound();
          announceBadgeEarned(result?.badgeId ?? 'enter-debug-console');
        }
      })
      .catch(() => {});
  }, [announceBadgeEarned]);

  const theme = useTheme();
  const useVerticalTabs = useMediaQuery(theme.breakpoints.down('md'));

  const activeTab = useMemo(
    () => TAB_DEFINITIONS.find((tab) => tab.id === activeTabId) ?? TAB_DEFINITIONS[0],
    [activeTabId]
  );

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        p: { xs: 2, sm: 4 }
      }}
    >
      <Stack spacing={3} sx={{ width: '100%', maxWidth: 960 }}>
        <Typography variant="h4" component="h1">
          DEBUG_CONSOLE
        </Typography>

        <Tabs
          value={activeTabId}
          onChange={(_event, value) => setActiveTabId(value)}
          aria-label="Debug console sections"
          textColor="primary"
          indicatorColor="primary"
          orientation={useVerticalTabs ? 'vertical' : 'horizontal'}
          variant="standard"
          sx={{
            width: '100%',
            ...(useVerticalTabs
              ? {
                  alignSelf: 'stretch',
                  '& .MuiTabs-flexContainer': {
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: 1,
                    flexWrap: 'nowrap'
                  },
                  '& .MuiTab-root': {
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    textAlign: 'left',
                    minWidth: 'auto'
                  },
                  '& .MuiTabs-indicator': {
                    left: 0
                  }
                }
              : {
                  '& .MuiTabs-flexContainer': {
                    flexWrap: 'wrap',
                    columnGap: 1,
                    rowGap: 1,
                    justifyContent: 'flex-start'
                  },
                  '& .MuiTab-root': {
                    minWidth: 'auto',
                    flex: '0 0 auto'
                  }
                })
          }}
        >
          {TAB_DEFINITIONS.map((tab) => (
            <Tab
              key={tab.id}
              label={tab.label}
              value={tab.id}
              id={`debug-tab-${tab.id}`}
              aria-controls={`debug-tabpanel-${tab.id}`}
            />
          ))}
        </Tabs>

        <Box sx={{ display: 'contents' }}>
          {activeTab ? <activeTab.Component /> : null}
        </Box>
      </Stack>
    </Box>
  );
}
