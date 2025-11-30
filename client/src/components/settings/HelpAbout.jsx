import PropTypes from 'prop-types';
import { Box, Stack, Typography, Button, Paper } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import NavigationIcon from '@mui/icons-material/Navigation';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import UpdateIcon from '@mui/icons-material/Update';
import MapIcon from '@mui/icons-material/Map';
import ListIcon from '@mui/icons-material/List';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import LoginIcon from '@mui/icons-material/Login';
import EditLocationAltIcon from '@mui/icons-material/EditLocationAlt';
import settingsPalette, { settingsButtonStyles } from './settingsPalette';

const helpSections = [
  {
    key: 'map',
    icon: <MapIcon />,
    title: 'Map',
    description: 'See nearby pins, filter overlays, and open chat or pin details directly from the map.',
    actionLabel: 'Open Map'
  },
  {
    key: 'list',
    icon: <ListIcon />,
    title: 'List',
    description: 'Browse pins in a list view with filters and friend requests; great for quick scans.',
    actionLabel: 'Open List'
  },
  {
    key: 'pin',
    icon: <EditLocationAltIcon />,
    title: 'Pin Details',
    description: 'View pin info, photos, chat, and attendance. Hosts can edit pins and see analytics.',
    actionLabel: 'View a Pin'
  },
  {
    key: 'bookmarks',
    icon: <BookmarkBorderIcon />,
    title: 'Bookmarks & History',
    description: 'Save pins to revisit later and track recently viewed pins for quick jump-back.',
    actionLabel: 'Open Bookmarks'
  },
  {
    key: 'updates',
    icon: <UpdateIcon />,
    title: 'Updates',
    description: 'Check notifications about pins, badges, bookmarks, and time-sensitive events.',
    actionLabel: 'Open Updates'
  },
  {
    key: 'chat',
    icon: <ChatBubbleOutlineIcon />,
    title: 'Chat',
    description: 'Chat with pin hosts or participants. Jump into threads from pins or the chat list.',
    actionLabel: 'Open Chat'
  },
  {
    key: 'profile',
    icon: <AccountCircleIcon />,
    title: 'Profile & Settings',
    description: 'Update your profile, preferences, privacy, and notification settings.',
    actionLabel: 'View Profile'
  },
  {
    key: 'create',
    icon: <NavigationIcon />,
    title: 'Create Pin',
    description: 'Share an event or discussion with a location, timeframe, and visibility settings.',
    actionLabel: 'Create a Pin'
  },
  {
    key: 'auth',
    icon: <LoginIcon />,
    title: 'Sign-in Basics',
    description: 'Use your account to sync bookmarks, chat, and notifications across devices.',
    actionLabel: 'Go to Login'
  }
];

const routeMap = {
  map: (routes) => routes.map.base,
  list: (routes) => routes.list.base,
  pin: (routes) => routes.map.base,
  bookmarks: (routes) => routes.bookmarks.base,
  updates: (routes) => routes.updates.base,
  chat: (routes) => routes.chat.base,
  profile: (routes) => routes.profile.me,
  create: (routes) => routes.createPin.base,
  auth: (routes) => routes.login
};

function HelpAbout({ routes, onNavigate }) {
  const handleNavigate = (key) => {
    const resolver = routeMap[key];
    if (!resolver || typeof onNavigate !== 'function') {
      return;
    }
    const target = resolver(routes);
    if (target) {
      onNavigate(target);
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <HelpOutlineIcon color="primary" />
        <Typography variant="h6" sx={{ color: settingsPalette.accent, fontWeight: 700 }}>
          Help & About
        </Typography>
      </Stack>
      <Typography variant="body2" sx={{ color: settingsPalette.textPrimary, mb: 1 }}>
        Learn what each page does and jump there quickly.
      </Typography>
      <Stack spacing={1.5}>
        {helpSections.map((section) => (
          <Paper
            key={section.key}
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 3,
              border: `1px solid ${settingsPalette.borderSubtle}`,
              backgroundColor: 'var(--color-surface)',
              boxShadow: settingsPalette.shadowSoft
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  backgroundColor: settingsPalette.pastelLavender,
                  color: settingsPalette.accent,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
                aria-hidden
              >
                {section.icon || <SettingsIcon />}
              </Box>
              <Stack spacing={0.5} flex={1} minWidth={0}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: settingsPalette.textPrimary }}>
                  {section.title}
                </Typography>
                <Typography variant="body2" sx={{ color: settingsPalette.textPrimary }}>
                  {section.description}
                </Typography>
                <Button
                  type="button"
                  size="small"
                  variant="contained"
                  onClick={() => handleNavigate(section.key)}
                  sx={{ ...settingsButtonStyles.contained, alignSelf: 'flex-start', mt: 0.5 }}
                >
                  {section.actionLabel}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
}

HelpAbout.propTypes = {
  routes: PropTypes.object.isRequired,
  onNavigate: PropTypes.func
};

HelpAbout.defaultProps = {
  onNavigate: undefined
};

export default HelpAbout;
