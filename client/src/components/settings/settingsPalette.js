const settingsPalette = {
  accent: '#5D3889',
  accentHover: '#4A2D73',
  accentLight: '#9B5DE5',
  textPrimary: '#1F1336',
  textMuted: 'rgba(31, 19, 54, 0.75)',
  pastelLavender: '#F5EFFD',
  pastelBlue: '#ECF8FE',
  borderSubtle: 'rgba(93, 56, 137, 0.18)',
  borderStrong: 'rgba(93, 56, 137, 0.35)',
  shadowSoft: '0 18px 45px rgba(93, 56, 137, 0.18)'
};

export default settingsPalette;

export const settingsButtonStyles = {
  contained: {
    backgroundColor: settingsPalette.accent,
    color: '#FFFFFF',
    fontWeight: 600,
    borderRadius: 999,
    textTransform: 'none',
    '&:hover': {
      backgroundColor: settingsPalette.accentHover
    },
    '&:disabled': {
      backgroundColor: 'rgba(93, 56, 137, 0.35)',
      color: '#FFFFFF'
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
