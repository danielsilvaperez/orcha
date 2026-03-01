export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown> ? DeepPartial<T[K]> : T[K];
};

export function deepMerge<T>(base: T, ...overrides: Array<DeepPartial<T> | undefined>): T {
  const output: Record<string, unknown> = { ...(base as Record<string, unknown>) };

  for (const override of overrides) {
    if (!override) {
      continue;
    }

    for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
      const existing = output[key];
      if (isPlainObject(existing) && isPlainObject(value)) {
        output[key] = deepMerge(existing, value);
      } else if (value !== undefined) {
        output[key] = value;
      }
    }
  }

  return output as T;
}
