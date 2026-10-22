import { Place, ModelInfo, DailyRecord, HourlyRecord, PredictRowInput, PredictResponse } from '../types';

const DIRECT_BACKEND_URL = (import.meta.env.VITE_API_BASE_URL || 'https://airqo-cole-charis-assgnmnt.onrender.com').replace(/\/$/, '');

export interface BackendHealthResponse {
  status: string;
  model: string;
  features?: string[];
  modeUsed?: 'Method A (Proxy)' | 'Method B (Direct)';
}

/**
 * Checks backend health using Method A (Vercel rewrite proxy) first,
 * falling back to Method B (Direct Cross-Origin call).
 */
export async function checkBackendHealth(): Promise<BackendHealthResponse> {
  // Try Method A first: /api/health
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch('/api/health', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      return { ...data, modeUsed: 'Method A (Proxy)' };
    }
  } catch {
    // Fall back to Method B
  }

  // Try Method B: Direct URL
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${DIRECT_BACKEND_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      return { ...data, modeUsed: 'Method B (Direct)' };
    }
  } catch (err) {
    throw new Error('Model service on Render is waking up. Free tier instances may require up to 60 seconds.');
  }

  throw new Error('Unable to reach backend service.');
}

/**
 * Predicts PM2.5 for rows using Method A first, falling back to Method B.
 */
export async function predictRows(rows: PredictRowInput[]): Promise<PredictResponse> {
  const payload = { rows };

  // Try Method A first
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fall back to Method B
  }

  // Method B fallback
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`${DIRECT_BACKEND_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Prediction service returned status ${res.status}`);
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('Prediction call failed.');
  }
}

/**
 * Loads static places list.
 */
export async function fetchPlaces(): Promise<Place[]> {
  const res = await fetch('/data/places.json');
  if (!res.ok) throw new Error('Failed to load places data');
  const data = await res.json();
  return data.places;
}

/**
 * Loads static model metadata.
 */
export async function fetchModelInfo(): Promise<ModelInfo> {
  const res = await fetch('/data/model_info.json');
  if (!res.ok) throw new Error('Failed to load model info');
  return await res.json();
}

/**
 * Loads August daily aggregates for all devices.
 */
export async function fetchDailyData(): Promise<Record<string, DailyRecord[]>> {
  const res = await fetch('/data/daily.json');
  if (!res.ok) throw new Error('Failed to load daily August data');
  return await res.json();
}

/**
 * Loads August hourly data for a single device.
 */
export async function fetchHourlyData(deviceName: string): Promise<HourlyRecord[]> {
  const res = await fetch(`/data/hourly/${deviceName}.json`);
  if (!res.ok) throw new Error(`Failed to load hourly data for ${deviceName}`);
  return await res.json();
}
