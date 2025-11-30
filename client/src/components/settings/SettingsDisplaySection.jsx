import PropTypes from 'prop-types';
import { Stack, Typography, Paper } from '@mui/material';
import AppearanceSettings from './AppearanceSettings';
import settingsPalette from './settingsPalette';

export default function SettingsDisplaySection({
  settings,
  theme,
  onThemeChange,
  textScale,
  onTextScaleChange,
  reduceMotion,
  onReduceMotionToggle,
  highContrast,
  onHighContrastToggle,
  mapDensity,
  onMapDensityChange,
  celebrationSounds,
  onCelebrationSoundsChange,
  showFriendBadges,
  onFriendBadgesChange,
  listSyncsWithMapLimit,
  onListSyncsToggle,
  radiusMiles,
  onRadiusChange,
  pinDensityLevels
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 3 },
        borderRadius: 4,
        backgroundColor: 'var(--color-surface)',
        border: `1px solid ${settingsPalette.borderSubtle}`,
        boxShadow: settingsPalette.shadowSoft
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" sx={{ color: settingsPalette.accent, fontWeight: 700 }}>
            Appearance & display
          </Typography>
        </Stack>
        <AppearanceSettings
          settings={settings}
          theme={theme}
          radiusMiles={radiusMiles}
          onThemeChange={onThemeChange}
          onRadiusChange={onRadiusChange}
          textScale={textScale}
          onTextScaleChange={onTextScaleChange}
          reduceMotion={reduceMotion}
          onReduceMotionToggle={onReduceMotionToggle}
          highContrast={highContrast}
          onHighContrastToggle={onHighContrastToggle}
          mapDensity={mapDensity}
          onMapDensityChange={onMapDensityChange}
          celebrationSounds={celebrationSounds}
          onCelebrationSoundsChange={onCelebrationSoundsChange}
          showFriendBadges={showFriendBadges}
          onFriendBadgesChange={onFriendBadgesChange}
          listSyncsWithMapLimit={listSyncsWithMapLimit}
          onListSyncsToggle={onListSyncsToggle}
          pinDensityLevels={pinDensityLevels}
        />
      </Stack>
    </Paper>
  );
}

SettingsDisplaySection.propTypes = {
  settings: PropTypes.object.isRequired,
  theme: PropTypes.string.isRequired,
  onThemeChange: PropTypes.func.isRequired,
  textScale: PropTypes.number.isRequired,
  onTextScaleChange: PropTypes.func.isRequired,
  reduceMotion: PropTypes.bool.isRequired,
  onReduceMotionToggle: PropTypes.func.isRequired,
  highContrast: PropTypes.bool.isRequired,
  onHighContrastToggle: PropTypes.func.isRequired,
  mapDensity: PropTypes.string.isRequired,
  onMapDensityChange: PropTypes.func.isRequired,
  celebrationSounds: PropTypes.bool.isRequired,
  onCelebrationSoundsChange: PropTypes.func.isRequired,
  showFriendBadges: PropTypes.bool.isRequired,
  onFriendBadgesChange: PropTypes.func.isRequired,
  listSyncsWithMapLimit: PropTypes.bool.isRequired,
  onListSyncsToggle: PropTypes.func.isRequired,
  radiusMiles: PropTypes.number,
  onRadiusChange: PropTypes.func.isRequired,
  pinDensityLevels: PropTypes.array.isRequired
};
