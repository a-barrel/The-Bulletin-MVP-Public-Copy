import { METERS_PER_MILE } from '../utils/geo';

export const DEMO_USER_ID = 'demo-user';
export const DEFAULT_RADIUS_MILES = 25;
export const DEFAULT_MAX_DISTANCE_METERS = Math.round(DEFAULT_RADIUS_MILES * METERS_PER_MILE);
export const FALLBACK_LOCATION = { latitude: 33.7838, longitude: -118.1136 };
export const DEFAULT_SPOOF_STEP_MILES = 1;
export const SPOOF_MIN_MILES = 0.25;
export const SPOOF_MAX_MILES = 5;
export const SPOOF_STEP_INCREMENT = 0.25;
