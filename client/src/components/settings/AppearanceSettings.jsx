import { useEffect, useState } from 'react';
import {
  Stack,
  Typography,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Slider,
  Switch,
  Button,
  Box,
  Grid,
  Typography as MuiTypography,
  Select,
  MenuItem
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import SettingsAccordion from './SettingsAccordion';
import settingsPalette, { mutedTextSx, settingsToggleLabelSx } from './settingsPalette';
import {
  EMERGENCY_LANGUAGE,
  LANGUAGE_OPTIONS,
  getActiveLanguage,
  setLanguage
} from '../../i18n/config';

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
  const { t, i18n } = useTranslation();
  const [language, setLanguageSelection] = useState(getActiveLanguage());
  const [languageStatus, setLanguageStatus] = useState('');

  useEffect(() => {
    const handleLanguageChange = (lng) => setLanguageSelection(lng);
    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  const handleLanguageChange = async (event) => {
    const nextLanguage = event.target.value || EMERGENCY_LANGUAGE.code;
    const applied = await setLanguage(nextLanguage);
    setLanguageSelection(applied);
    setLanguageStatus(t('settings.language.saved'));
  };

  const handleEmergencyEnglish = async () => {
    const applied = await setLanguage(EMERGENCY_LANGUAGE.code);
    setLanguageSelection(applied);
    setLanguageStatus(t('settings.language.saved'));
  };

  const themeOptions = [
    { value: 'light', label: 'Light', preview: 'linear-gradient(135deg,#f5effd,#ffffff)' },
    { value: 'dark', label: 'Dark', preview: 'linear-gradient(135deg,#1b1230,#2b1c4a)' },
    { value: 'neon', label: 'Neon Flux', preview: 'linear-gradient(135deg,#00eaff,#ff2fb3)' },
    { value: 'sunset', label: 'Sunset Pop', preview: 'linear-gradient(135deg,#ffb35c,#ff7a5c,#c83f70)' },
    { value: 'forest', label: 'Forest Mist', preview: 'linear-gradient(135deg,#1c261f,#3d8f6f,#6bdd9f)' },
    { value: 'ocean', label: 'Oceanic', preview: 'linear-gradient(135deg,#0f2230,#1f4f73,#4fd3ff)' },
    { value: 'candy', label: 'Candyland', preview: 'linear-gradient(135deg,#ff7bd5,#b94bff,#70d6ff)' },
    { value: 'glitch', label: 'Glitch Punk', preview: 'linear-gradient(135deg,#00eaff,#ff008c,#6a7dff)' },
    { value: 'plasma', label: 'Plasma Bloom', preview: 'linear-gradient(135deg,#7aff7a,#7f3bff,#6fffdc)' },
    { value: 'rainbow', label: 'Midnight Rainbow', preview: 'linear-gradient(135deg,#5ce1ff,#ff9a00,#ff4d8d,#c77dff)' },
    { value: 'aurora', label: 'Aurora Motion', preview: 'linear-gradient(135deg,#7cf0ff,#6a7dff,#9b7bff)' },
    { value: 'rainbow-animated', label: 'Rainbow Burst (Animated)', preview: 'linear-gradient(120deg,#5ce1ff,#ff9a00,#ff4d8d,#c77dff,#5ce1ff)' }
  ];

  const handleThemeSelect = (value) => {
    onThemeChange({ target: { value } });
  };

  return (
    <Stack spacing={2}>
      <SettingsAccordion
        title={t('settings.language.title')}
        description={t('settings.language.description')}
        defaultExpanded
      >
        <FormControl component="fieldset" sx={{ gap: 1 }}>
          <FormLabel component="legend" sx={{ fontSize: '0.875rem', color: settingsPalette.accent }}>
            {t('settings.language.optionsLabel')}
          </FormLabel>
          <Select
            value={language}
            onChange={handleLanguageChange}
            size="small"
            sx={{
              maxWidth: 260,
              color: settingsPalette.textPrimary,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: settingsPalette.accentHover },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: settingsPalette.accentHover },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: settingsPalette.accent },
              '& .MuiSelect-icon': { color: settingsPalette.accentHover }
            }}
          >
            {LANGUAGE_OPTIONS.filter((option) => !option.emergency).map((option) => (
              <MenuItem key={option.label} value={option.code}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
            <Button
              variant="outlined"
              size="small"
              onClick={handleEmergencyEnglish}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {t('settings.language.emergency')}
            </Button>
            {languageStatus ? (
              <Typography variant="caption" sx={mutedTextSx}>
                {languageStatus}
              </Typography>
            ) : null}
          </Stack>
        </FormControl>
      </SettingsAccordion>

      <SettingsAccordion
        title={t('settings.tabs.appearance')}
        description="Match the system palette or lock in your favorite look."
      >
        <FormControl component="fieldset" sx={{ gap: 1 }}>
          <FormLabel component="legend" sx={{ fontSize: '0.875rem', color: settingsPalette.accent }}>
            {t('settings.tabs.appearance')}
          </FormLabel>
          <Grid container spacing={1.5}>
            {themeOptions.map((option) => {
              const isActive = theme === option.value;
              return (
                <Grid item xs={12} sm={6} md={4} key={option.value}>
                  <Button
                    type="button"
                    onClick={() => handleThemeSelect(option.value)}
                    variant={isActive ? 'contained' : 'outlined'}
                    fullWidth
                    sx={{
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      borderRadius: 3,
                      p: 1.25,
                      gap: 1,
                      backgroundColor: isActive ? settingsPalette.accent : 'transparent',
                      color: isActive ? 'var(--color-text-on-accent)' : settingsPalette.textPrimary,
                      borderColor: isActive ? settingsPalette.accent : settingsPalette.borderSubtle,
                      boxShadow: isActive ? '0 10px 24px rgba(0,0,0,0.18)' : 'none',
                      '&:hover': {
                        backgroundColor: isActive ? settingsPalette.accentHover : 'color-mix(in srgb, var(--accent-wash) 60%, transparent)'
                      }
                    }}
                  >
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: 2,
                        background: option.preview,
                        border: `1px solid ${settingsPalette.borderSubtle}`,
                        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.12), 0 6px 12px rgba(0,0,0,0.12)'
                      }}
                      aria-hidden
                    />
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <MuiTypography variant="body1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        {option.label}
                      </MuiTypography>
                      <MuiTypography variant="caption" sx={{ color: isActive ? 'inherit' : 'var(--color-text-secondary)' }}>
                        {option.value}
                      </MuiTypography>
                    </Box>
                  </Button>
                </Grid>
              );
            })}
          </Grid>
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
        title={t('tooltips.settings.accessibility')}
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
        title={t('tooltips.settings.pinDensity')}
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
        title={t('tooltips.settings.nearbyRadius')}
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
