export const PIN_DENSITY_LEVELS = [
  {
    key: 'compact',
    label: 'Compact',
    description: 'Snappy overview',
    limit: 30
  },
  {
    key: 'balanced',
    label: 'Balanced',
    description: 'Good mix of context',
    limit: 60
  },
  {
    key: 'detailed',
    label: 'Detailed',
    description: 'Maximum coverage',
    limit: 120
  }
];

export const PIN_DENSITY_LIMITS = PIN_DENSITY_LEVELS.reduce((acc, level) => {
  acc[level.key] = level.limit;
  return acc;
}, {});

export const DEFAULT_PIN_DENSITY_KEY = 'compact';

export const resolvePinDensityKey = (input) => {
  const extractKey = (value) => {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim().toLowerCase();
    return PIN_DENSITY_LIMITS[normalized] ? normalized : null;
  };

  if (!input) {
    return DEFAULT_PIN_DENSITY_KEY;
  }

  if (typeof input === 'string') {
    return extractKey(input) ?? DEFAULT_PIN_DENSITY_KEY;
  }

  const candidate =
    extractKey(input?.preferences?.display?.mapDensity) ||
    extractKey(input?.display?.mapDensity) ||
    extractKey(input.mapDensity);

  return candidate ?? DEFAULT_PIN_DENSITY_KEY;
};

export const resolvePinFetchLimit = (input) => {
  const key = resolvePinDensityKey(input);
  return PIN_DENSITY_LIMITS[key] ?? PIN_DENSITY_LIMITS[DEFAULT_PIN_DENSITY_KEY];
};
