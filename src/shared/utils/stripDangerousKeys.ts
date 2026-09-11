import { DANGEROUS_OBJECT_KEYS } from './safeJsonReviver';

// Same bug as safeJsonReviver.ts, for req.query (parsed by qs, never
// touches the JSON reviver). qs blocks `__proto__` but not `constructor`/
// `toString`. Recurses for qs's nested query support (`a[b][c]=1`).
export function stripDangerousKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(stripDangerousKeys) as unknown as T;
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (DANGEROUS_OBJECT_KEYS.has(key)) continue;
      result[key] = stripDangerousKeys(val);
    }
    return result as T;
  }

  return value;
}
