import type { Place } from "../decision/types";

/** Nominatim asks for a real UA and ≤1 req/s. Both are respected here. */
const UA = "Tablestakes/1.0 (restaurant decision app)";
let lastCall = 0;

async function throttle() {
  const wait = 1100 - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

export const FALLBACK_PLACES: Place[] = [
  { lat: 37.7599, lng: -122.4148, neighborhood: "The Mission", city: "San Francisco", label: "The Mission, SF" },
  { lat: 37.7975, lng: -122.4079, neighborhood: "North Beach", city: "San Francisco", label: "North Beach, SF" },
  { lat: 37.7857, lng: -122.4011, neighborhood: "SoMa", city: "San Francisco", label: "SoMa, SF" },
  { lat: 37.7694, lng: -122.4862, neighborhood: "The Richmond", city: "San Francisco", label: "The Richmond, SF" },
  { lat: 40.7336, lng: -74.0027, neighborhood: "Greenwich Village", city: "New York", label: "Greenwich Village, NYC" },
  { lat: 40.7223, lng: -73.9874, neighborhood: "Lower East Side", city: "New York", label: "Lower East Side, NYC" },
  { lat: 40.7182, lng: -73.9584, neighborhood: "Williamsburg", city: "New York", label: "Williamsburg, NYC" },
];

interface NominatimAddress {
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
}

export async function reverseGeocode(lat: number, lng: number): Promise<Place> {
  const bare: Place = {
    lat,
    lng,
    neighborhood: null,
    city: null,
    label: `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
  };
  try {
    await throttle();
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14`;
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return bare;
    const data = (await res.json()) as { address?: NominatimAddress };
    const a = data.address ?? {};
    const neighborhood =
      a.neighbourhood ?? a.suburb ?? a.quarter ?? a.city_district ?? null;
    const city = a.city ?? a.town ?? a.village ?? a.municipality ?? null;
    return {
      lat,
      lng,
      neighborhood,
      city,
      label: [neighborhood, city].filter(Boolean).join(", ") || bare.label,
    };
  } catch {
    return bare;
  }
}

export function currentPosition(timeoutMs = 8000): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("no geolocation"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: timeoutMs,
      maximumAge: 5 * 60 * 1000,
      enableHighAccuracy: false,
    });
  });
}

/** Never dead-ends: a denial or timeout just means the picker opens. */
export async function locate(): Promise<Place | null> {
  try {
    const pos = await currentPosition();
    return await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
  } catch {
    return null;
  }
}

const KEY = "ts.device_id";
export function deviceId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
