import { Stack, Typography, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, Slider, Switch } from '@mui/material';

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
    <Stack spacing={1.5}>
      <Typography variant="h6">Theme &amp; typography</Typography>
      <FormControl component="fieldset">
        <FormLabel component="legend" sx={{ fontSize: '0.875rem' }}>
          Theme
        </FormLabel>
        <RadioGroup row value={theme} onChange={onThemeChange}>
          <FormControlLabel value="system" control={<Radio />} label="Match system" />
          <FormControlLabel value="light" control={<Radio />} label="Light" />
          <FormControlLabel value="dark" control={<Radio />} label="Dark" />
        </RadioGroup>
      </FormControl>

      <Stack spacing={1}>
        <Typography variant="body2" color="text.secondary">
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

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <FormControlLabel
          control={<Switch checked={reduceMotion} onChange={(_, checked) => onReduceMotionToggle(checked)} />}
          label="Reduce motion & animations"
        />
        <FormControlLabel
          control={<Switch checked={highContrast} onChange={(_, checked) => onHighContrastToggle(checked)} />}
          label="High contrast mode"
        />
        <FormControlLabel
          control={<Switch checked={celebrationSounds} onChange={(_, checked) => onCelebrationSoundsToggle(checked)} />}
          label="Play celebration sounds"
        />
        <FormControlLabel
          control={<Switch checked={showFriendBadges} onChange={(_, checked) => onShowFriendBadgesToggle(checked)} />}
          label="Show friend badges next to names"
        />
      </Stack>

      <Typography variant="caption" color="text.secondary">
        Celebration sounds follow this setting everywhere in the app.
      </Typography>

      <FormControl component="fieldset" sx={{ mt: 1 }}>
        <FormLabel component="legend" sx={{ fontSize: '0.875rem' }}>
          Pin display limit
        </FormLabel>
        <RadioGroup row value={mapDensity} onChange={onMapDensityChange}>
          {pinDensityOptions.map((option) => (
            <FormControlLabel
              key={option.key}
              value={option.key}
              control={<Radio />}
              label={`${option.label} (${option.limit} pins)`}
            />
          ))}
        </RadioGroup>
        <Typography variant="caption" color="text.secondary">
          Controls how many pins the map loads at once. Detailed mode fetches the most pins but may use more bandwidth.
        </Typography>
        <FormControlLabel
          sx={{ mt: 1 }}
          control={<Switch checked={listSyncsWithMapLimit} onChange={(_, checked) => onListSyncsToggle(checked)} />}
          label="Match List view to this limit"
        />
        <Typography variant="caption" color="text.secondary">
          When enabled, the List page shows the same pin set as the map so both views stay in sync.
        </Typography>
      </FormControl>

      <Stack spacing={2}>
        <Typography variant="h6">Location radius</Typography>
        <Typography variant="body2" color="text.secondary">
          Adjust how far from your location the app should pull nearby pins and updates.
        </Typography>
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
        <Typography variant="caption" color="text.secondary">
          Current radius: {radiusMeters} m ({radiusMiles ?? 'N/A'} mi)
        </Typography>
      </Stack>
    </Stack>
  );
}

export default AppearanceSettings;
