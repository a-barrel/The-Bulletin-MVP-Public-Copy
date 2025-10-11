import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import FigmaMobileShell from './FigmaMobileShell';
import figmaProfile from '../data/figmaProfile.json';

const StatBadge = ({ label, value, color }) => (
  <Paper
    elevation={0}
    sx={{
      backgroundColor: color,
      borderRadius: 3,
      px: 2,
      py: 1.5,
      minWidth: 120,
      display: 'flex',
      flexDirection: 'column',
      gap: 0.5,
      border: '1px solid rgba(93, 56, 137, 0.1)'
    }}
  >
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="h6" sx={{ fontWeight: 700 }}>
      {value}
    </Typography>
  </Paper>
);

const ProfilePrototype = () => {
  const { header, profile, stats, actions } = figmaProfile;
  const primaryAction = actions.find((action) => action.variant === 'primary');
  const secondaryActions = actions.filter((action) => action.variant === 'secondary');

  return (
    <FigmaMobileShell time={header.time} title={header.title} contentSpacing={2.5}>
      <Paper
        elevation={0}
        sx={{
          backgroundColor: profile.backgroundColor,
          borderRadius: 4,
          px: 3,
          py: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              backgroundColor: profile.avatar.backgroundColor || profile.cardColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: profile.avatar.foregroundColor || '#5d3889',
              fontSize: '2.25rem',
              fontWeight: 700
            }}
          >
            {profile.avatar.letter || profile.username.charAt(0)}
          </Box>
          <Stack spacing={0.5}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {profile.username}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {profile.joined}
            </Typography>
          </Stack>
        </Stack>

        <Paper
          elevation={0}
          sx={{
            backgroundColor: profile.cardColor,
            borderRadius: 3,
            px: 2.5,
            py: 2,
            border: '1px solid rgba(93, 56, 137, 0.2)'
          }}
        >
          <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
            {profile.description}
          </Typography>
        </Paper>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        >
          {stats.map((stat) => (
            <StatBadge key={stat.label} label={stat.label} value={stat.value} color={profile.cardColor} />
          ))}
        </Stack>

        <Stack spacing={1.5}>
          {primaryAction && (
            <Button
              startIcon={<PersonAddAltRoundedIcon />}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '1rem',
                backgroundColor: primaryAction.backgroundColor,
                color: primaryAction.textColor,
                borderRadius: 3,
                py: 1.5,
                '&:hover': {
                  backgroundColor: primaryAction.backgroundColor
                }
              }}
              disableElevation
              variant="contained"
            >
              {primaryAction.label}
            </Button>
          )}

          <Divider sx={{ borderColor: 'rgba(93, 56, 137, 0.12)' }} />

          <Stack direction="row" spacing={1} justifyContent="space-between">
            {secondaryActions.map((action) => (
              <Button
                key={action.id}
                variant="contained"
                sx={{
                  textTransform: 'none',
                  flex: 1,
                  fontWeight: 600,
                  borderRadius: 3,
                  backgroundColor: action.backgroundColor,
                  color: action.textColor,
                  '&:hover': {
                    backgroundColor: action.backgroundColor
                  }
                }}
              >
                {action.label}
              </Button>
            ))}
          </Stack>
        </Stack>
      </Paper>
    </FigmaMobileShell>
  );
};

export default ProfilePrototype;
