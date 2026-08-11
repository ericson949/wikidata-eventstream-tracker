import * as fs from 'fs';
import * as path from 'path';

// ─── Environment Detection for Vercel KV / Upstash Redis ─────────────────────
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || null;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || null;

const isKvAvailable = Boolean(KV_URL && KV_TOKEN);

async function kvFetch(command: string, ...args: unknown[]): Promise<unknown> {
  if (!isKvAvailable) return null;
  try {
    // Upstash / Vercel KV REST API format: POST with body [command, ...args]
    const res = await fetch(KV_URL!.replace(/\/$/, ''), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([command, ...args]),
    });
    const data = (await res.json()) as { result: unknown };
    return data.result;
  } catch (e) {
    console.warn(`[KV] Error executing ${command}:`, (e as Error).message);
    return null;
  }
}

// ─── Data Access Layer (KV in production, local JSON in dev) ────────────────

export async function dbRead<T = unknown>(key: string, fallbackFile: string): Promise<T | null> {
  const filePath = path.join(process.cwd(), 'data', fallbackFile);

  // 1. Try Vercel KV if configured
  if (isKvAvailable) {
    const rawKv = await kvFetch('GET', key);
    if (rawKv !== null && rawKv !== undefined) {
      try {
        return (typeof rawKv === 'string' ? JSON.parse(rawKv) : rawKv) as T;
      } catch (e) {
        return rawKv as T;
      }
    }

    // Seed KV from local JSON file on first run
    try {
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(fileContent) as T;
        await kvFetch('SET', key, JSON.stringify(parsed));
        console.log(`[KV] Auto-seeded key '${key}' from local file ${fallbackFile}`);
        return parsed;
      }
    } catch (e) {}
  }

  // 2. Fallback to local JSON file
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    }
  } catch (e) {}

  return null;
}

export async function dbWrite(key: string, data: unknown, fallbackFile: string): Promise<boolean> {
  const filePath = path.join(process.cwd(), 'data', fallbackFile);
  let kvSaved = false;

  // 1. Write to Vercel KV if available
  if (isKvAvailable) {
    const res = await kvFetch('SET', key, JSON.stringify(data));
    kvSaved = res === 'OK';
  }

  // 2. Write to local file (dev environment)
  let fileSaved = false;
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    fileSaved = true;
  } catch (e) {
    // Expected on Vercel Serverless (read-only filesystem)
  }

  // Success if either KV saved (prod) or file saved (local)
  return kvSaved || fileSaved;
}
