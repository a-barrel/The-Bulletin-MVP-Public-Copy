import { lazy, useEffect, useState } from 'react';

const pageModules = import.meta.glob('../pages/**/*.{jsx,tsx}');

const deriveIdFromPath = (path) =>
  path.replace(/^\.?\.?\/?pages\//, '').replace(/\.\w+$/, '').replace(/[\\/]+/g, '-');

const deriveLabelFromId = (id) =>
  id
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ') || 'Page';

const normalizePath = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const loadPages = async () => {
  const entries = await Promise.all(
    Object.entries(pageModules).map(async ([path, importer]) => {
      try {
        const module = await importer();
      const RawComponent = module.default;
      const isRenderable =
        typeof RawComponent === 'function' ||
        (RawComponent && typeof RawComponent === 'object' && RawComponent.$$typeof);
      if (!isRenderable) {
        console.warn('Skipping page module without default component:', path);
        return null;
      }

        const config = module.pageConfig || module.navConfig || {};
        const id =
          typeof config.id === 'string' && config.id.trim().length > 0
            ? config.id.trim()
            : deriveIdFromPath(path);
        const label =
          typeof config.label === 'string' && config.label.trim().length > 0
            ? config.label.trim()
            : deriveLabelFromId(id);
        const order = Number.isFinite(config.order) ? config.order : Number.POSITIVE_INFINITY;
        const IconComponent = config.icon;
        const pathValue = normalizePath(config.path ?? `/${id.toLowerCase()}`);
        const aliases = Array.isArray(config.aliases)
          ? config.aliases.map(normalizePath).filter(Boolean)
          : [];
        const navTargetPath = normalizePath(config.navTargetPath);
        const navResolver =
          typeof config.resolveNavTarget === 'function' ? config.resolveNavTarget : null;
        const showInNav = config.showInNav === true;
        const isDefault = Boolean(config.isDefault);
        const isProtected = config.protected !== false;
        const Component = lazy(importer);

        return {
          id,
          label,
          order,
          icon: IconComponent,
          path: pathValue,
          aliases,
          navTargetPath,
          navResolver,
          showInNav,
          isDefault,
          isProtected,
          Component
        };
      } catch (error) {
        console.error('Failed to load page module', path, error);
        return null;
      }
    })
  );

  return entries
    .filter((page) => Boolean(page?.Component && page.path))
    .sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.label.localeCompare(b.label);
    });
};

export const useLazyPages = () => {
  const [pages, setPages] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadPages()
      .then((loaded) => {
        if (!cancelled) {
          setPages(loaded);
          setReady(true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setPages([]);
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { pages, ready, error };
};

export const normalizePathValue = normalizePath;
