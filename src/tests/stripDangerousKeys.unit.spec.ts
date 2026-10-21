import { stripDangerousKeys } from '@shared/utils/stripDangerousKeys';

describe('stripDangerousKeys', () => {
  it('removes Object.prototype-colliding keys from a flat object', () => {
    const input = {
      product_code: 'SKU-1',
      constructor: { x: 1 },
      toString: 'nope',
    };

    expect(stripDangerousKeys(input)).toEqual({ product_code: 'SKU-1' });
  });

  it('recurses into nested objects', () => {
    const input = {
      filter: { constructor: { x: 1 }, name: 'ok' },
    };

    expect(stripDangerousKeys(input)).toEqual({ filter: { name: 'ok' } });
  });

  it('recurses into arrays', () => {
    const input: unknown[] = [{ constructor: 1, name: 'a' }, { name: 'b' }];

    expect(stripDangerousKeys(input)).toEqual([{ name: 'a' }, { name: 'b' }]);
  });

  it('leaves primitives, null and ordinary objects untouched', () => {
    expect(stripDangerousKeys('hello')).toBe('hello');
    expect(stripDangerousKeys(42)).toBe(42);
    expect(stripDangerousKeys(null)).toBeNull();
    expect(stripDangerousKeys({ a: 1, b: [1, 2, 3] })).toEqual({
      a: 1,
      b: [1, 2, 3],
    });
  });

  it('does not actually pollute Object.prototype while stripping', () => {
    stripDangerousKeys(
      JSON.parse('{"__proto__":{"polluted":true},"a":1}') as unknown
    );

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
