import { useEffect, useMemo, useRef, useState } from 'react';
import Supercluster from 'supercluster';

const buildGeoJsonPoints = (pins = []) =>
  pins
    .map((pin) => {
      const coords = pin?.coordinates?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) {
        return null;
      }
      const [longitude, latitude] = coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
      }
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        properties: {
          pin
        }
      };
    })
    .filter(Boolean);

export default function usePinClusters(pins, { radius = 60, maxZoom = 18, enabled = true } = {}) {
  const [clusters, setClusters] = useState([]);
  const indexRef = useRef(null);

  const points = useMemo(() => (enabled ? buildGeoJsonPoints(pins) : []), [enabled, pins]);

  useEffect(() => {
    if (!enabled || !points.length) {
      indexRef.current = null;
      setClusters([]);
      return;
    }
    const index = new Supercluster({
      radius,
      maxZoom
    });
    index.load(points);
    indexRef.current = index;
  }, [enabled, maxZoom, points, radius]);

  const getClusters = (bbox, zoom) => {
    if (!enabled || !indexRef.current) {
      return [];
    }
    try {
      return indexRef.current.getClusters(bbox, Math.round(zoom));
    } catch {
      return [];
    }
  };

  const getExpansionZoom = (clusterId) => {
    if (!indexRef.current) {
      return null;
    }
    try {
      return indexRef.current.getClusterExpansionZoom(clusterId);
    } catch {
      return null;
    }
  };

  return {
    clusters,
    setClusters,
    getClusters,
    getExpansionZoom
  };
}
