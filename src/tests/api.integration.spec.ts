import request from 'supertest';
import type { App as AppType } from '@shared/infra/app';
import { pool } from '@shared/infra/database/pg/pool';
import { runMigrations } from '@shared/infra/database/pg/migrate';
import { DEFAULT_DEV_API_KEY } from '@config/env';

// Every product this suite creates is prefixed with this run-unique tag —
// the products table is a real, shared Postgres database, so codes must
// not collide across parallel test files or previous runs, and cleanup
// must be scoped to exactly what this run created rather than a blanket
// wipe.
const RUN = Date.now();
const code = (suffix: string) => `IT${RUN}-${suffix}`;

// No real broker in this suite — the picks route is exercised end-to-end
// (validation → controller → use case → queue adapter) against a fake
// channel so the HTTP wiring is proven without a RabbitMQ dependency.
const publishMock = jest.fn().mockReturnValue(true);
const amqplibConnectMock = jest.fn().mockResolvedValue({
  createChannel: jest.fn().mockResolvedValue({ publish: publishMock }),
  on: jest.fn(),
});
jest.mock('amqplib', () => ({
  __esModule: true,
  default: { connect: (...args: unknown[]) => amqplibConnectMock(...args) },
  connect: (...args: unknown[]) => amqplibConnectMock(...args),
}));

function withAuth<T extends request.Test>(req: T): T {
  return req.set('X-API-Key', DEFAULT_DEV_API_KEY) as T;
}

describe('Products API (integration)', () => {
  let app: AppType;

  beforeAll(async () => {
    await runMigrations(pool);
    const { App } = await import('@shared/infra/app');
    app = new App();
    await app.init();
  });

  afterAll(async () => {
    await pool.query('DELETE FROM products WHERE product_code LIKE $1', [
      `IT${RUN}-%`,
    ]);
    await pool.end();
  });

  it('GET /health returns ok', async () => {
    const res = await request(app.server).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /health/live returns ok', async () => {
    const res = await request(app.server).get('/health/live');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('GET /health/ready reports the postgres storage check', async () => {
    const res = await request(app.server).get('/health/ready');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks.storage).toBe('ok');
    expect(res.body.checks).toHaveProperty('rabbitmq');
  });

  it('GET /docs serves the OpenAPI UI', async () => {
    const res = await request(app.server).get('/docs/');

    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
  });

  it('rejects a request under /api/v1 with no API key', async () => {
    const res = await request(app.server).get('/api/v1/products');

    expect(res.status).toBe(401);
    expect(res.body.type).toBe('Unauthorized');
  });

  it('rejects a request under /api/v1 with a wrong API key', async () => {
    const res = await request(app.server)
      .get('/api/v1/products')
      .set('X-API-Key', 'not-the-right-key');

    expect(res.status).toBe(401);
  });

  it('performs a full CRUD flow', async () => {
    const productCode = code('CRUD');

    const createRes = await withAuth(
      request(app.server).post('/api/v1/products')
    ).send({ product_code: productCode, quantity: 5, pick_location: 'A1' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.product_code).toBe(productCode);

    const listRes = await withAuth(request(app.server).get('/api/v1/products'));
    expect(listRes.status).toBe(200);
    expect(
      listRes.body.data.some(
        (item: { product_code: string }) => item.product_code === productCode
      )
    ).toBe(true);

    const getRes = await withAuth(
      request(app.server).get(`/api/v1/products/${productCode}`)
    );
    expect(getRes.status).toBe(200);
    expect(getRes.body.quantity).toBe(5);

    const updateRes = await withAuth(
      request(app.server).put(`/api/v1/products/${productCode}`)
    ).send({ quantity: 20, pick_location: 'B2' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.quantity).toBe(20);

    const deleteRes = await withAuth(
      request(app.server).delete(`/api/v1/products/${productCode}`)
    );
    expect(deleteRes.status).toBe(200);

    const getAfterDelete = await withAuth(
      request(app.server).get(`/api/v1/products/${productCode}`)
    );
    expect(getAfterDelete.status).toBe(404);
  });

  it('applies a relative quantity_delta on PUT', async () => {
    const productCode = code('DELTA-1');
    await withAuth(request(app.server).post('/api/v1/products')).send({
      product_code: productCode,
      quantity: 10,
      pick_location: 'A1',
    });

    const updateRes = await withAuth(
      request(app.server).put(`/api/v1/products/${productCode}`)
    ).send({ quantity_delta: -3, pick_location: 'A1' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.quantity).toBe(7);
  });

  it('allows creating and absolute-setting a product to zero stock', async () => {
    // 0 is a valid stock level (out of stock), reachable via quantity_delta
    // (the repository guard is `quantity + delta >= 0`) — create and
    // absolute-set must accept it too.
    const productCode = code('ZERO-STOCK');
    const createRes = await withAuth(
      request(app.server).post('/api/v1/products')
    ).send({ product_code: productCode, quantity: 0, pick_location: 'A1' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.quantity).toBe(0);

    const updateRes = await withAuth(
      request(app.server).put(`/api/v1/products/${productCode}`)
    ).send({ quantity: 0, pick_location: 'A1' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.quantity).toBe(0);
  });

  it('never loses an update under real concurrent PUT quantity_delta requests', async () => {
    // Genuinely concurrent HTTP requests through the real app (not
    // sequential awaits) — proves the atomic UPDATE resolves the race
    // rather than losing a decrement.
    const productCode = code('CONCURRENT-DELTA');
    const CONCURRENT_REQUESTS = 20;
    await withAuth(request(app.server).post('/api/v1/products')).send({
      product_code: productCode,
      quantity: CONCURRENT_REQUESTS,
      pick_location: 'A1',
    });

    await Promise.all(
      Array.from({ length: CONCURRENT_REQUESTS }, () =>
        withAuth(
          request(app.server).put(`/api/v1/products/${productCode}`)
        ).send({ quantity_delta: -1, pick_location: 'A1' })
      )
    );

    const finalRes = await withAuth(
      request(app.server).get(`/api/v1/products/${productCode}`)
    );
    expect(finalRes.body.quantity).toBe(0);
  });

  it('rejects a quantity_delta that would drive stock negative', async () => {
    const productCode = code('DELTA-2');
    await withAuth(request(app.server).post('/api/v1/products')).send({
      product_code: productCode,
      quantity: 2,
      pick_location: 'A1',
    });

    const updateRes = await withAuth(
      request(app.server).put(`/api/v1/products/${productCode}`)
    ).send({ quantity_delta: -5, pick_location: 'A1' });

    expect(updateRes.status).toBe(409);
    expect(updateRes.body.type).toBe('Conflict');
  });

  it('rejects PUT when both quantity and quantity_delta are provided', async () => {
    const productCode = code('DELTA-3');
    await withAuth(request(app.server).post('/api/v1/products')).send({
      product_code: productCode,
      quantity: 5,
      pick_location: 'A1',
    });

    const updateRes = await withAuth(
      request(app.server).put(`/api/v1/products/${productCode}`)
    ).send({ quantity: 10, quantity_delta: 1, pick_location: 'A1' });

    expect(updateRes.status).toBe(400);
    expect(updateRes.body.type).toBe('VALIDATION_FAILED');
  });

  it('rejects PUT when neither quantity nor quantity_delta is provided', async () => {
    const productCode = code('DELTA-4');
    await withAuth(request(app.server).post('/api/v1/products')).send({
      product_code: productCode,
      quantity: 5,
      pick_location: 'A1',
    });

    const updateRes = await withAuth(
      request(app.server).put(`/api/v1/products/${productCode}`)
    ).send({ pick_location: 'A1' });

    expect(updateRes.status).toBe(400);
    expect(updateRes.body.type).toBe('VALIDATION_FAILED');
  });

  it('returns 400 for an invalid payload', async () => {
    const res = await withAuth(
      request(app.server).post('/api/v1/products')
    ).send({ product_code: '', quantity: -1, pick_location: '' });

    expect(res.status).toBe(400);
    expect(res.body.type).toBe('VALIDATION_FAILED');
  });

  it('returns a consistent JSON error for a malformed JSON body, not an HTML page', async () => {
    // express.json() throws before the request reaches the /api/v1 router
    // where handlingErrors lives, so app.ts needs its own dedicated
    // handler for this to stay a {message, type} JSON shape, not Express's
    // default text/html error page.
    const res = await withAuth(request(app.server).post('/api/v1/products'))
      .set('Content-Type', 'application/json')
      .send('{"product_code":');

    expect(res.status).toBe(400);
    expect(res.type).toBe('application/json');
    expect(res.body.type).toBe('VALIDATION_FAILED');
  });

  it('does not 500 on a body containing an Object.prototype-colliding key', async () => {
    // yup's ObjectSchema looks up each incoming key against its internal
    // `fields` map with plain bracket access, so a body key named e.g.
    // `constructor` or `__proto__` would resolve to the *inherited*
    // Object.prototype member instead of undefined and crash calling
    // .resolve() on it. safeJsonReviver strips these keys at the
    // JSON.parse boundary, before Yup ever sees them.
    const productCode = code('PROTO');
    // A raw JSON string, not an object literal passed to .send(): object
    // literal syntax treats `__proto__: value` as setting the actual
    // prototype (Annex B legacy behavior), which JSON.stringify would then
    // never serialize as an own key — the real attack is a literal
    // "__proto__" key in the JSON *text*, exactly like a real HTTP client
    // would send it, which is what needs to survive JSON.parse safely.
    const rawBody = `{"product_code":"${productCode}","quantity":1,"pick_location":"A1","__proto__":{"polluted":true},"constructor":{"also":"dangerous"}}`;
    const res = await withAuth(request(app.server).post('/api/v1/products'))
      .set('Content-Type', 'application/json')
      .send(rawBody);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      product_code: productCode,
      quantity: 1,
      pick_location: 'A1',
    });
  });

  it('returns 409 when creating a duplicate product', async () => {
    const productCode = code('DUP-1');
    await withAuth(request(app.server).post('/api/v1/products')).send({
      product_code: productCode,
      quantity: 1,
      pick_location: 'A1',
    });

    const res = await withAuth(
      request(app.server).post('/api/v1/products')
    ).send({ product_code: productCode, quantity: 1, pick_location: 'A1' });

    expect(res.status).toBe(409);
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app.server).get('/unknown-route');

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Route Not Found');
  });

  it('returns 404 for an unmatched path under /api/v1/products', async () => {
    const res = await withAuth(
      request(app.server).get('/api/v1/products/foo/bar')
    );

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Route Not Found');
  });

  it('returns 400 for an invalid product_code path parameter', async () => {
    const res = await withAuth(
      request(app.server).get('/api/v1/products/bad!code')
    );

    expect(res.status).toBe(400);
    expect(res.body.type).toBe('VALIDATION_FAILED');
  });

  it('returns 400 for an invalid pagination query parameter', async () => {
    const res = await withAuth(
      request(app.server).get('/api/v1/products?limit=not-a-number')
    );

    expect(res.status).toBe(400);
    expect(res.body.type).toBe('VALIDATION_FAILED');
  });

  it('does not 500 on a query string containing an Object.prototype-colliding key', async () => {
    // Same class of issue as the JSON-body case above, different source:
    // req.query comes from qs, not JSON.parse, so the body reviver never
    // runs against it. qs already special-cases __proto__, but not
    // constructor/toString/etc — stripDangerousKeys covers this input too.
    const res = await withAuth(
      request(app.server).get(
        '/api/v1/products?limit=5&constructor[x]=1&toString=y'
      )
    );

    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(5);
  });

  it('GET /metrics exposes Prometheus metrics after a request', async () => {
    await request(app.server).get('/health');

    const res = await request(app.server).get('/metrics');

    expect(res.status).toBe(200);
    expect(res.type).toBe('text/plain');
    expect(res.text).toContain('http_requests_total');
  });

  it('generates an X-Request-Id header when none is sent', async () => {
    const res = await request(app.server).get('/health');

    expect(res.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('echoes a caller-supplied X-Request-Id header', async () => {
    const res = await request(app.server)
      .get('/health')
      .set('X-Request-Id', 'caller-id-123');

    expect(res.headers['x-request-id']).toBe('caller-id-123');
  });

  describe('POST /api/v1/picks', () => {
    beforeEach(() => {
      publishMock.mockClear();
    });

    it('returns 202 and publishes a pick.created event', async () => {
      const res = await withAuth(
        request(app.server).post('/api/v1/picks')
      ).send({
        product_code: code('PICK-001'),
        quantity: 2,
        pick_location: 'A1',
      });

      expect(res.status).toBe(202);
      expect(res.body.status).toBe('accepted');
      expect(res.body.pickId).toEqual(expect.any(String));
      expect(publishMock).toHaveBeenCalledTimes(1);
    });

    it("rejects a pick for zero quantity, unlike a product's stock", async () => {
      // Unlike product stock (see "allows creating and absolute-setting a
      // product to zero stock" above), picking zero units is never
      // meaningful — this must stay rejected.
      const res = await withAuth(
        request(app.server).post('/api/v1/picks')
      ).send({
        product_code: code('PICK-ZERO'),
        quantity: 0,
        pick_location: 'A1',
      });

      expect(res.status).toBe(400);
      expect(res.body.type).toBe('VALIDATION_FAILED');
      expect(publishMock).not.toHaveBeenCalled();
    });

    it('does not publish twice for a repeated Idempotency-Key', async () => {
      const payload = {
        product_code: code('PICK-002'),
        quantity: 1,
        pick_location: 'A1',
      };

      const first = await withAuth(request(app.server).post('/api/v1/picks'))
        .set('Idempotency-Key', `int-test-key-${RUN}`)
        .send(payload);

      const second = await withAuth(request(app.server).post('/api/v1/picks'))
        .set('Idempotency-Key', `int-test-key-${RUN}`)
        .send(payload);

      expect(first.body.pickId).toBe(second.body.pickId);
      expect(publishMock).toHaveBeenCalledTimes(1);
    });

    it('returns 400 for an invalid payload', async () => {
      const res = await withAuth(
        request(app.server).post('/api/v1/picks')
      ).send({ product_code: '', quantity: -1, pick_location: '' });

      expect(res.status).toBe(400);
      expect(res.body.type).toBe('VALIDATION_FAILED');
    });
  });
});
