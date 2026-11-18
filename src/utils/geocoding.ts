import { useEffect, useState } from 'react';
import {
  DEFAULT_GPS_POSITION,
  DEFAULT_QUARTIER,
  findQuartierByText,
  isInsideGrandLibreville,
  matchLocalQuartier,
} from '../data/quartiers';
import { GpsPoint } from '../types';

export const HIGH_ACCURACY_GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 5000,
};

const CACHE_KEY = 'sxs_reverse_geo_cache_v2';
const memoryCache = new Map<string, string>();
const inflightRequests = new Map<string, Promise<string>>();

function loadSessionCache(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function saveSessionCacheEntry(key: string, label: string) {
  memoryCache.set(key, label);
  try {
    const current = loadSessionCache();
    const keys = Object.keys(current);
    if (keys.length > 80) {
      delete current[keys[0]];
    }
    current[key] = label;
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(current));
  } catch {
    // ignore storage errors
  }
}

export function getDefaultDetectedGpsPoint(): GpsPoint {
  return {
    ...DEFAULT_GPS_POSITION,
    neighborhood: DEFAULT_QUARTIER.label,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Associe instantanément des coordonnées GPS au quartier réel le plus proche
 * dans la base géographique complète d'Akanda, Libreville et Owendo.
 */
export function fallbackLibrevilleNeighborhood(lat: number, lng: number): string {
  if (!isInsideGrandLibreville(lat, lng)) {
    return `Zone (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
  return matchLocalQuartier(lat, lng).label;
}

export function resolveLocalNeighborhoodSync(coords?: GpsPoint | null): string | null {
  if (!coords) return null;
  if (coords.neighborhood) return coords.neighborhood;
  if (typeof coords.lat !== 'number' || typeof coords.lng !== 'number') return null;

  const cacheKey = `${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`;
  const cached = memoryCache.get(cacheKey) || loadSessionCache()[cacheKey];
  if (cached) return cached;

  if (isInsideGrandLibreville(coords.lat, coords.lng)) {
    return matchLocalQuartier(coords.lat, coords.lng).label;
  }
  return null;
}

interface NominatimAddress {
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  residential?: string;
  city_district?: string;
  hamlet?: string;
  village?: string;
  town?: string;
  city?: string;
  municipality?: string;
  road?: string;
  state?: string;
}

interface NominatimResponse {
  display_name?: string;
  address?: NominatimAddress;
}

function formatNominatimNeighborhood(data: NominatimResponse, lat: number, lng: number): string {
  const addr = data.address;
  if (addr) {
    const quartier =
      addr.neighbourhood ||
      addr.quarter ||
      addr.suburb ||
      addr.residential ||
      addr.city_district ||
      addr.hamlet ||
      addr.road;
    const commune = addr.town || addr.city || addr.village || addr.municipality || addr.state;

    // Vérifier d'abord si Nominatim cite un quartier connu de notre base locale
    const matchedFromNominatim = findQuartierByText(quartier) || findQuartierByText(data.display_name);
    if (matchedFromNominatim) {
      return matchedFromNominatim.label;
    }

    if (quartier && commune) {
      if (quartier.toLowerCase() === commune.toLowerCase()) {
        return quartier;
      }
      return `${quartier}, ${commune}`;
    }
    if (quartier) return quartier;
    if (commune) return commune;
  }

  if (data.display_name) {
    const matched = findQuartierByText(data.display_name);
    if (matched) return matched.label;

    const parts = data.display_name
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]}, ${parts[1]}`;
    }
    if (parts.length === 1) {
      return parts[0];
    }
  }

  return fallbackLibrevilleNeighborhood(lat, lng);
}

/**
 * Traduit des coordonnées GPS (lat, lng) en nom de quartier réel d'Akanda, Libreville ou Owendo
 * en combinant la base locale haute précision (Haversine) et OpenStreetMap Nominatim.
 */
export async function reverseGeocodeNeighborhood(lat: number, lng: number): Promise<string> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return DEFAULT_QUARTIER.label;
  }

  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const memHit = memoryCache.get(cacheKey);
  if (memHit) return memHit;

  const sessionMap = loadSessionCache();
  if (sessionMap[cacheKey]) {
    memoryCache.set(cacheKey, sessionMap[cacheKey]);
    return sessionMap[cacheKey];
  }

  // Correspondance locale immédiate dans Grand Libreville (Akanda / Libreville / Owendo)
  if (isInsideGrandLibreville(lat, lng)) {
    const localMatch = matchLocalQuartier(lat, lng);
    if (localMatch.distanceKm <= 2.2) {
      saveSessionCacheEntry(cacheKey, localMatch.label);
      return localMatch.label;
    }
  }

  const pending = inflightRequests.get(cacheKey);
  if (pending) return pending;

  const requestPromise = (async () => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 5500) : null;

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lng)}&zoom=16&addressdetails=1`;

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'fr',
        },
        ...(controller ? { signal: controller.signal } : {}),
      });

      if (!response.ok) {
        const fb = fallbackLibrevilleNeighborhood(lat, lng);
        saveSessionCacheEntry(cacheKey, fb);
        return fb;
      }

      const data = (await response.json()) as NominatimResponse;
      const formatted = formatNominatimNeighborhood(data, lat, lng);
      saveSessionCacheEntry(cacheKey, formatted);
      return formatted;
    } catch {
      const fb = fallbackLibrevilleNeighborhood(lat, lng);
      memoryCache.set(cacheKey, fb);
      return fb;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      inflightRequests.delete(cacheKey);
    }
  })();

  inflightRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

/**
 * Hook React retournant automatiquement le nom de quartier exact à partir de coordonnées GPS.
 */
export function useReverseGeocodedNeighborhood(coords?: GpsPoint | null): string | null {
  const lat = coords?.lat;
  const lng = coords?.lng;
  const providedNeighborhood = coords?.neighborhood;

  const [resolved, setResolved] = useState<string | null>(() =>
    resolveLocalNeighborhoodSync(coords)
  );

  useEffect(() => {
    if (providedNeighborhood) {
      setResolved(providedNeighborhood);
      return;
    }
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      setResolved(null);
      return;
    }

    const immediate = resolveLocalNeighborhoodSync({ lat, lng });
    if (immediate) {
      setResolved(immediate);
    }

    let cancelled = false;
    reverseGeocodeNeighborhood(lat, lng).then((name) => {
      if (!cancelled) {
        setResolved(name);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [lat, lng, providedNeighborhood]);

  return resolved;
}
