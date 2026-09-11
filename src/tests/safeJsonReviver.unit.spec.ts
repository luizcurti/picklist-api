import { safeJsonReviver } from '@shared/utils/safeJsonReviver';

describe('safeJsonReviver', () => {
  it.each([
    '__proto__',
    'constructor',
    'toString',
    'valueOf',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
    'toLocaleString',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__',
  ])('strips the dangerous key %s', (key) => {
    expect(safeJsonReviver(key, { anything: true })).toBeUndefined();
  });

  it('leaves ordinary keys untouched', () => {
    expect(safeJsonReviver('product_code', 'SKU-1')).toBe('SKU-1');
    expect(safeJsonReviver('quantity', 10)).toBe(10);
  });

  it('drops __proto__ as an own key end to end through JSON.parse', () => {
    const raw = '{"product_code":"SKU-1","__proto__":{"polluted":true}}';

    const parsed = JSON.parse(raw, safeJsonReviver) as Record<string, unknown>;

    expect(Object.prototype.hasOwnProperty.call(parsed, '__proto__')).toBe(
      false
    );
    expect(parsed.product_code).toBe('SKU-1');
    // Confirms no actual prototype pollution occurred either.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
