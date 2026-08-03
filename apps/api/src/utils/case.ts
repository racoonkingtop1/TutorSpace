/** snake_case DB rows -> camelCase API responses. Shallow by design — nested
 * jsonb columns (e.g. subscription_plans.features) are already the right shape. */
export function toCamelRow<T = Record<string, unknown>>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    out[camelKey] = value;
  }
  return out as T;
}

export function toCamelRows<T = Record<string, unknown>>(rows: Record<string, unknown>[]): T[] {
  return rows.map((r) => toCamelRow<T>(r));
}
