import fs from 'fs';
import path from 'path';

const localesDir = path.join(__dirname, '..', '..', 'src', 'i18n', 'locales');
const baseLocale = 'en';

const flattenKeys = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return flattenKeys(value, nextKey);
    }
    return nextKey;
  });

const extractPlaceholders = (value) => {
  if (typeof value !== 'string') return [];
  const matches = value.match(/{{\s*[\w.]+\s*}}/g) || [];
  return matches.map((m) => m.replace(/[{}]/g, '').trim());
};

describe('i18n locale parity', () => {
  it('all locales include every English key', () => {
    const basePath = path.join(localesDir, baseLocale, 'common.json');
    const baseContent = JSON.parse(fs.readFileSync(basePath, 'utf8'));
    const baseKeys = new Set(flattenKeys(baseContent));

    const localeDirs = fs
      .readdirSync(localesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== baseLocale)
      .map((entry) => entry.name);

    const missingByLocale = {};

    localeDirs.forEach((locale) => {
      const localePath = path.join(localesDir, locale, 'common.json');
      const localeContent = JSON.parse(fs.readFileSync(localePath, 'utf8'));
      const localeKeys = new Set(flattenKeys(localeContent));
      const missing = [...baseKeys].filter((key) => !localeKeys.has(key));
      if (missing.length) {
        missingByLocale[locale] = missing;
      }
    });

    const localesMissingKeys = Object.keys(missingByLocale);
    if (localesMissingKeys.length) {
      const message = localesMissingKeys
        .map((locale) => `${locale}: missing ${missingByLocale[locale].length} keys`)
        .join('\n');
      throw new Error(`Locale parity failed:\n${message}`);
    }
  });

  it('preserves placeholder sets for each key', () => {
    const basePath = path.join(localesDir, baseLocale, 'common.json');
    const baseContent = JSON.parse(fs.readFileSync(basePath, 'utf8'));

    const locales = fs
      .readdirSync(localesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== baseLocale)
      .map((entry) => entry.name);

    locales.forEach((locale) => {
      const localePath = path.join(localesDir, locale, 'common.json');
      const localeContent = JSON.parse(fs.readFileSync(localePath, 'utf8'));

      const stack = [[baseContent, localeContent, '']];
      while (stack.length) {
        const [baseNode, localeNode, pathPrefix] = stack.pop();
        Object.keys(baseNode).forEach((key) => {
          const baseVal = baseNode[key];
          const localeVal = localeNode ? localeNode[key] : undefined;
          const nextPath = pathPrefix ? `${pathPrefix}.${key}` : key;
          if (baseVal && typeof baseVal === 'object' && !Array.isArray(baseVal)) {
            stack.push([baseVal, localeVal, nextPath]);
            return;
          }
          const basePlaceholders = extractPlaceholders(baseVal).sort().join(',');
          const localePlaceholders = extractPlaceholders(localeVal).sort().join(',');
          if (basePlaceholders !== localePlaceholders) {
            throw new Error(
              `Placeholder mismatch at ${nextPath} for locale ${locale}: expected [${basePlaceholders}] got [${localePlaceholders}]`
            );
          }
        });
      }
    });
  });
});
