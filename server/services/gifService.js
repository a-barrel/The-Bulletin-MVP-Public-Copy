const runtimeConfig = require('../config/runtime');
const { logIntegration } = require('../utils/devLogger');

let cachedFetch = null;

const ensureFetch = async () => {
  if (typeof fetch === 'function') {
    return fetch.bind(global);
  }
  if (!cachedFetch) {
    const mod = await import('node-fetch');
    cachedFetch = mod.default;
  }
  return cachedFetch;
};

const pickRandom = (items) => {
  if (!Array.isArray(items) || !items.length) {
    return undefined;
  }
  const index = Math.floor(Math.random() * items.length);
  return items[index];
};

const buildAttachmentFromTenorMedia = (result) => {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const mediaFormats = result.media_formats || {};
  const primary =
    mediaFormats.gif ||
    mediaFormats.mediumgif ||
    mediaFormats.tinygif ||
    mediaFormats.nanogif ||
    null;

  if (!primary || !primary.url) {
    return null;
  }

  const thumbnail = mediaFormats.tinygif || mediaFormats.nanogif || mediaFormats.gif || null;
  const dims = Array.isArray(primary.dims) ? primary.dims : [];

  return {
    url: primary.url,
    thumbnailUrl: thumbnail?.url || undefined,
    width: Number.isFinite(dims[0]) ? Number(dims[0]) : undefined,
    height: Number.isFinite(dims[1]) ? Number(dims[1]) : undefined,
    mimeType: 'image/gif',
    description: result.content_description || undefined
  };
};

const ensureApiKey = () => {
  const apiKey = runtimeConfig.integrations?.tenor?.apiKey;
  if (!apiKey) {
    return { ok: false, reason: 'missing-api-key' };
  }
  return { ok: true, apiKey };
};

const normalizeQuery = (query) => {
  if (typeof query !== 'string') {
    return '';
  }
  return query.trim();
};

async function searchGifAttachments(query, { limit = 12 } = {}) {
  const queryResult = ensureApiKey();
  if (!queryResult.ok) {
    return queryResult;
  }

  const searchTerm = normalizeQuery(query);
  if (!searchTerm) {
    return { ok: false, reason: 'empty-query' };
  }

  const size = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 50) : 12;

  try {
    const fetcher = await ensureFetch();
    const endpoint = new URL('https://tenor.googleapis.com/v2/search');
    endpoint.searchParams.set('q', searchTerm);
    endpoint.searchParams.set('key', queryResult.apiKey);
    endpoint.searchParams.set(
      'client_key',
      runtimeConfig.integrations?.tenor?.clientKey || 'pinpoint-app'
    );
    endpoint.searchParams.set('limit', String(size));
    endpoint.searchParams.set('media_filter', 'gif,tinygif,mediumgif');
    endpoint.searchParams.set('random', 'true');
    endpoint.searchParams.set(
      'contentfilter',
      runtimeConfig.integrations?.tenor?.contentFilter || 'high'
    );

    const response = await fetcher(endpoint.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      const message = `Tenor API responded with status ${response.status}`;
      console.warn(message);
      return { ok: false, reason: 'api-error', message };
    }

    const payload = await response.json().catch(() => ({}));
    const results = Array.isArray(payload?.results) ? payload.results : [];
    const mapped = results
      .map((result) => {
        const attachment = buildAttachmentFromTenorMedia(result);
        if (!attachment) {
          return null;
        }
        return {
          attachment,
          sourceUrl: result?.itemurl || result?.url || undefined,
          id: result?.id || attachment.url
        };
      })
      .filter(Boolean);

    if (!mapped.length) {
      return { ok: false, reason: 'no-results' };
    }

    return {
      ok: true,
      results: mapped
    };
  } catch (error) {
    console.error('Failed to fetch Tenor GIF:', error);
    logIntegration('tenor:search', error);
    return { ok: false, reason: 'unexpected-error', message: error.message };
  }
}

async function fetchGifAttachment(query, options = {}) {
  const result = await searchGifAttachments(query, options);
  if (!result.ok) {
    return result;
  }

  const selected = pickRandom(result.results);
  if (!selected) {
    return { ok: false, reason: 'no-results' };
  }

  return {
    ok: true,
    attachment: selected.attachment,
    sourceUrl: selected.sourceUrl,
    id: selected.id
  };
}

module.exports = {
  searchGifAttachments,
  fetchGifAttachment
};
