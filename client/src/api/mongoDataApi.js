import { z } from 'zod';
import { IsoDateStringSchema } from '../schemas/common.js';
import { LocationQuerySchema, NearbyUserSchema } from '../schemas/location.js';

const REQUIRED_ENV_VARS = [
  'VITE_MONGODB_DATA_API_URL',
  'VITE_MONGODB_DATA_API_KEY',
  'VITE_MONGODB_DATA_SOURCE',
  'VITE_MONGODB_DATABASE',
  'VITE_MONGODB_COLLECTION_LOCATIONS'
];

let cachedConfig;

export function isMongoDataApiConfigured() {
  try {
    resolveConfig();
    return true;
  } catch (err) {
    console.warn('MongoDB Data API not configured:', err.message);
    return false;
  }
}

function resolveConfig() {
  if (cachedConfig) return cachedConfig;

  const missing = REQUIRED_ENV_VARS.filter((key) => !import.meta.env[key]);
  if (missing.length) {
    throw new Error(`Missing MongoDB Data API config: ${missing.join(', ')}`);
  }

  cachedConfig = {
    baseUrl: import.meta.env.VITE_MONGODB_DATA_API_URL.replace(/\/$/, ''),
    apiKey: import.meta.env.VITE_MONGODB_DATA_API_KEY,
    dataSource: import.meta.env.VITE_MONGODB_DATA_SOURCE,
    database: import.meta.env.VITE_MONGODB_DATABASE,
    locationsCollection: import.meta.env.VITE_MONGODB_COLLECTION_LOCATIONS
  };

  return cachedConfig;
}

function withBasePayload(collection, payload = {}) {
  const { dataSource, database } = resolveConfig();
  return {
    dataSource,
    database,
    collection,
    ...payload
  };
}

function convertExtendedJson(value) {
  if (Array.isArray(value)) {
    return value.map(convertExtendedJson);
  }

  if (value && typeof value === 'object') {
    if ('$oid' in value) return value.$oid;
    if ('$date' in value) {
      const dateVal = value.$date;
      if (typeof dateVal === 'string') return dateVal;
      if (dateVal && typeof dateVal === 'object' && '$numberLong' in dateVal) {
        return new Date(Number(dateVal.$numberLong)).toISOString();
      }
      return dateVal;
    }
    if ('$numberDouble' in value) return Number(value.$numberDouble);
    if ('$numberInt' in value) return Number(value.$numberInt);
    if ('$numberLong' in value) return Number(value.$numberLong);

    return Object.entries(value).reduce((acc, [key, val]) => {
      acc[key] = convertExtendedJson(val);
      return acc;
    }, {});
  }

  return value;
}

async function dataApiRequest(action, { collection, ...rest }) {
  const { baseUrl, apiKey } = resolveConfig();
  const response = await fetch(`${baseUrl}/action/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify(withBasePayload(collection, rest))
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.error) {
    const message = payload.error || response.statusText || 'MongoDB Data API request failed';
    throw new Error(message);
  }

  return convertExtendedJson(payload);
}

const LocationWriteSchema = z.object({
  userId: z.string().min(1),
  coordinates: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([
      z.number().min(-180).max(180),
      z.number().min(-90).max(90)
    ])
  }),
  isPublic: z.boolean().default(true),
  accuracy: z.number().min(0).max(5000).optional(),
  createdAt: IsoDateStringSchema.optional(),
  lastSeenAt: IsoDateStringSchema.optional(),
  expiresAt: IsoDateStringSchema.optional()
});

export async function insertLocationUpdate(input) {
  const { locationsCollection } = resolveConfig();
  const parsed = LocationWriteSchema.parse(input);
  const now = new Date().toISOString();
  const document = {
    ...parsed,
    createdAt: parsed.createdAt ?? now,
    lastSeenAt: parsed.lastSeenAt ?? now
  };

  const result = await dataApiRequest('insertOne', {
    collection: locationsCollection,
    document
  });

  return result.insertedId;
}

export async function fetchNearbyUsers(query) {
  const { locationsCollection } = resolveConfig();
  const parsedQuery = LocationQuerySchema.parse(query);

  const pipeline = [
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [parsedQuery.longitude, parsedQuery.latitude]
        },
        distanceField: 'distanceMeters',
        maxDistance: parsedQuery.maxDistance,
        spherical: true
      }
    },
    { $match: { isPublic: true } },
    {
      $project: {
        _id: 0,
        userId: 1,
        coordinates: 1,
        distanceMeters: 1,
        lastSeenAt: { $ifNull: ['$lastSeenAt', '$createdAt'] }
      }
    },
    { $limit: 50 }
  ];

  const result = await dataApiRequest('aggregate', {
    collection: locationsCollection,
    pipeline
  });

  const documents = result.documents || [];
  return z.array(NearbyUserSchema).parse(documents);
}
