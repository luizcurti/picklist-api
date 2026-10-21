// Strips keys matching Object.prototype members (__proto__, constructor,
// ...) at parse time — yup's ObjectSchema does a plain bracket lookup on
// these against its `fields` object, resolving to the inherited member
// instead of undefined and crashing (500) calling .resolve() on it.
export const DANGEROUS_OBJECT_KEYS = new Set(
  Object.getOwnPropertyNames(Object.prototype)
);

export function safeJsonReviver(key: string, value: unknown): unknown {
  if (DANGEROUS_OBJECT_KEYS.has(key)) {
    return undefined;
  }
  return value;
}
