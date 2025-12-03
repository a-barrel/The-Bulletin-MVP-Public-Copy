const settingsPalette = {
  accent: 'var(--accent-strong)',
  accentHover: 'color-mix(in srgb, var(--accent-strong) 85%, transparent)',
  accentLight: 'var(--accent-primary)',
  textPrimary: 'var(--color-text-primary)',
  textMuted: 'color-mix(in srgb, var(--color-text-primary) 75%, transparent)',
  pastelLavender: 'var(--accent-wash)',
  pastelBlue: 'var(--color-surface-wash)',
  borderSubtle: 'var(--accent-border)',
  borderStrong: 'var(--border-strong)',
  shadowSoft: '0 18px 45px rgba(93, 56, 137, 0.18)'
};

export default settingsPalette;

export const settingsButtonStyles = {
  contained: {
    backgroundColor: settingsPalette.accent,
    color: 'var(--color-text-on-accent)',
    fontWeight: 600,
    borderRadius: 999,
    textTransform: 'none',
    '&:hover': {
      backgroundColor: settingsPalette.accentHover
    },
    '&:disabled': {
      backgroundColor: 'color-mix(in srgb, var(--accent-strong) 35%, transparent)',
      color: 'var(--color-text-on-accent)'
    }
  },
  outlined: {
    borderColor: settingsPalette.accent,
    color: settingsPalette.accent,
    fontWeight: 600,
    borderRadius: 999,
    textTransform: 'none',
    '&:hover': {
      borderColor: settingsPalette.accentHover,
      color: settingsPalette.accentHover,
      backgroundColor: settingsPalette.pastelLavender
    },
    '&:disabled': {
      borderColor: settingsPalette.borderSubtle,
      color: settingsPalette.borderSubtle
    }
  },
  text: {
    color: settingsPalette.accent,
    textTransform: 'none',
    fontWeight: 600,
    borderRadius: 999,
    '&:hover': {
      backgroundColor: settingsPalette.pastelLavender,
      color: settingsPalette.accentHover
    }
  }
};

export const settingsToggleLabelSx = {
  color: settingsPalette.textPrimary,
  '.MuiFormControlLabel-label': {
    color: settingsPalette.textPrimary
  }
};

export const mutedTextSx = { color: settingsPalette.textMuted };
