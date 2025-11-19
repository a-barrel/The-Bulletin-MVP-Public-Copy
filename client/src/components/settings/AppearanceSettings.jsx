import {
  Stack,
  Typography,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Slider,
  Switch
} from '@mui/material';
import SettingsAccordion from './SettingsAccordion';
import settingsPalette, { mutedTextSx, settingsToggleLabelSx } from './settingsPalette';

function AppearanceSettings({
  theme,
  onThemeChange,
  textScale,
  onTextScaleChange,
  reduceMotion,
  onReduceMotionToggle,
  highContrast,
  onHighContrastToggle,
  celebrationSounds,
  onCelebrationSoundsToggle,
  showFriendBadges,
  onShowFriendBadgesToggle,
  mapDensity,
  pinDensityOptions,
  onMapDensityChange,
  listSyncsWithMapLimit,
  onListSyncsToggle,
  radiusMeters,
  radiusMiles,
  onRadiusChange,
  radiusMin,
  radiusMax,
  formatMetersToMiles
}) {
  return (
    <Stack spacing={2}>
      <SettingsAccordion title="Theme & typography" description="Match the system palette or lock in your favorite look.">
        <FormControl component="fieldset">
          <FormLabel component="legend" sx={{ fontSize: '0.875rem', color: settingsPalette.accent }}>
            Theme
          </FormLabel>
          <RadioGroup
            row
            value={theme}
            onChange={onThemeChange}
            sx={{
              color: settingsPalette.textPrimary,
              '& .MuiFormControlLabel-label': { color: settingsPalette.textPrimary }
            }}
          >
            <FormControlLabel value="system" control={<Radio />} label="Match system" />
            <FormControlLabel value="light" control={<Radio />} label="Light" />
            <FormControlLabel value="dark" control={<Radio />} label="Dark" />
          </RadioGroup>
        </FormControl>
        <Stack spacing={1}>
          <Typography variant="body2" sx={mutedTextSx}>
            Adjust text size to improve readability.
          </Typography>
          <Slider
            min={0.8}
            max={1.4}
            step={0.05}
            value={textScale}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
            onChange={onTextScaleChange}
          />
        </Stack>
      </SettingsAccordion>

      <SettingsAccordion
        title="Accessibility & cues"
        description="Tweak animations, contrast, celebratory effects, and friend badges."
        defaultExpanded={false}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <FormControlLabel
            control={<Switch checked={reduceMotion} onChange={(_, checked) => onReduceMotionToggle(checked)} />}
            label="Reduce motion & animations"
            sx={settingsToggleLabelSx}
          />
          <FormControlLabel
            control={<Switch checked={highContrast} onChange={(_, checked) => onHighContrastToggle(checked)} />}
            label="High contrast mode"
            sx={settingsToggleLabelSx}
          />
          <FormControlLabel
            control={<Switch checked={celebrationSounds} onChange={(_, checked) => onCelebrationSoundsToggle(checked)} />}
            label="Play celebration sounds"
            sx={settingsToggleLabelSx}
          />
          <FormControlLabel
            control={<Switch checked={showFriendBadges} onChange={(_, checked) => onShowFriendBadgesToggle(checked)} />}
            label="Show friend badges next to names"
            sx={settingsToggleLabelSx}
          />
        </Stack>
        <Typography variant="caption" sx={mutedTextSx}>
          Celebration sounds follow this setting everywhere in the app.
        </Typography>
      </SettingsAccordion>

      <SettingsAccordion
        title="Pin density"
        description="Control how many pins load at once across Map and List."
        defaultExpanded={false}
      >
        <FormControl component="fieldset">
          <FormLabel
            component="legend"
            sx={{ fontSize: '0.875rem', color: settingsPalette.accent }}
          >
            Pin display limit
          </FormLabel>
          <RadioGroup
            row
            value={mapDensity}
            onChange={onMapDensityChange}
            sx={{
              color: settingsPalette.textPrimary,
              '& .MuiFormControlLabel-label': { color: settingsPalette.textPrimary }
            }}
          >
            {pinDensityOptions.map((option) => (
              <FormControlLabel
                key={option.key}
                value={option.key}
                control={<Radio />}
                label={`${option.label} (${option.limit} pins)`}
              />
            ))}
          </RadioGroup>
          <Typography variant="caption" sx={mutedTextSx}>
            Detailed mode fetches the most pins but may use more bandwidth.
          </Typography>
          <FormControlLabel
            control={<Switch checked={listSyncsWithMapLimit} onChange={(_, checked) => onListSyncsToggle(checked)} />}
            label="Match List view to this limit"
            sx={{ ...settingsToggleLabelSx, mt: 1 }}
          />
          <Typography variant="caption" sx={mutedTextSx}>
            When enabled, the List page shows the same pin set as the map so both views stay in sync.
          </Typography>
        </FormControl>
      </SettingsAccordion>

      <SettingsAccordion
        title="Nearby radius"
        description="Define how far from your location we fetch pins and updates."
        defaultExpanded={false}
      >
        <Slider
          value={radiusMeters}
          min={radiusMin}
          max={radiusMax}
          step={500}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => {
            const miles = formatMetersToMiles(value);
            return miles === null ? 'N/A' : `${Math.round(miles * 10) / 10} mi`;
          }}
          onChange={onRadiusChange}
        />
        <Typography variant="caption" sx={mutedTextSx}>
          Current radius: {radiusMeters} m ({radiusMiles ?? 'N/A'} mi)
        </Typography>
      </SettingsAccordion>
    </Stack>
  );
}

export default AppearanceSettings;
