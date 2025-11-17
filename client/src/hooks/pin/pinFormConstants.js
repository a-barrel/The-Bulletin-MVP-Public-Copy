import { METERS_PER_MILE } from '../../utils/geo';

export const MAX_PIN_DISTANCE_MILES = 50;
export const MAX_PIN_DISTANCE_METERS = MAX_PIN_DISTANCE_MILES * METERS_PER_MILE;
export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
export const EVENT_MAX_LEAD_TIME_MS = 14 * MILLISECONDS_PER_DAY;
export const DISCUSSION_MAX_DURATION_MS = 3 * MILLISECONDS_PER_DAY;
export const FUTURE_TOLERANCE_MS = 60 * 1000;
export const DEFAULT_APPROX_MESSAGE = 'Near your current location';
