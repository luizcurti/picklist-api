import request from 'supertest';

/**
 * Black-box E2E suite: makes real HTTP requests over the network against a
 * server that must already be running (e.g. `docker compose up`), as
 * opposed to the in-process integration suite. Run with `npm run test:e2e`.
 */
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3005';
// A literal duplicate of env.ts's DEFAULT_DEV_API_KEY, not an import — this
// suite is intentionally black-box and shouldn't reach into app internals.
// Override with E2E_API_KEY if the target container uses a different key.
const API_KEY = process.env.E2E_API_KEY || 'dev-local-key';

function withAuth<T extends request.Test>(req: T): T {
  return req.set('X-API-Key', API_KEY) as T;
}

describe('Products API (e2e)', () => {
  it('GET /health reports the service is up', async () => {
    const res = await request(BASE_URL).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('GET /docs serves the Swagger UI', async () => {
    const res = await request(BASE_URL).get('/docs/');

    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
  });

  it('rejects a request under /api/v1 with no API key', async () => {
    const res = await request(BASE_URL).get('/api/v1/products');

    expect(res.status).toBe(401);
  });

  describe('happy path: full CRUD lifecycle', () => {
    const productCode = `E2E-${Date.now()}`;

    it('creates the product', async () => {
      const res = await withAuth(
        request(BASE_URL).post('/api/v1/products')
      ).send({ product_code: productCode, quantity: 5, pick_location: 'A1' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        product_code: productCode,
        quantity: 5,
        pick_location: 'A1',
      });
    });

    it('lists the product', async () => {
      const res = await withAuth(request(BASE_URL).get('/api/v1/products'));

      expect(res.status).toBe(200);
      expect(
        res.body.data.some(
          (item: { product_code: string }) => item.product_code === productCode
        )
      ).toBe(true);
    });

    it('fetches the product by code', async () => {
      const res = await withAuth(
        request(BASE_URL).get(`/api/v1/products/${productCode}`)
      );

      expect(res.status).toBe(200);
      expect(res.body.quantity).toBe(5);
    });

    it('updates the product', async () => {
      const res = await withAuth(
        request(BASE_URL).put(`/api/v1/products/${productCode}`)
      ).send({ quantity: 42, pick_location: 'B2' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        product_code: productCode,
        quantity: 42,
        pick_location: 'B2',
      });
    });

    it('deletes the product', async () => {
      const res = await withAuth(
        request(BASE_URL).delete(`/api/v1/products/${productCode}`)
      );

      expect(res.status).toBe(200);
    });

    it('confirms the product no longer exists', async () => {
      const res = await withAuth(
        request(BASE_URL).get(`/api/v1/products/${productCode}`)
      );

      expect(res.status).toBe(404);
    });
  });

  describe('sad paths', () => {
    it('rejects an invalid payload with 400', async () => {
      const res = await withAuth(
        request(BASE_URL).post('/api/v1/products')
      ).send({ product_code: '', quantity: -1, pick_location: '' });

      expect(res.status).toBe(400);
      expect(res.body.type).toBe('VALIDATION_FAILED');
    });

    it('rejects an invalid path parameter with 400', async () => {
      const res = await withAuth(
        request(BASE_URL).get('/api/v1/products/bad!code')
      );

      expect(res.status).toBe(400);
    });

    it('rejects an invalid query parameter with 400', async () => {
      const res = await withAuth(
        request(BASE_URL).get('/api/v1/products?limit=not-a-number')
      );

      expect(res.status).toBe(400);
    });

    it('rejects a duplicate product with 409', async () => {
      const productCode = `E2E-DUP-${Date.now()}`;

      await withAuth(request(BASE_URL).post('/api/v1/products')).send({
        product_code: productCode,
        quantity: 1,
        pick_location: 'A1',
      });

      const res = await withAuth(
        request(BASE_URL).post('/api/v1/products')
      ).send({ product_code: productCode, quantity: 1, pick_location: 'A1' });

      expect(res.status).toBe(409);

      await withAuth(
        request(BASE_URL).delete(`/api/v1/products/${productCode}`)
      );
    });

    it('returns 404 for a non-existent product on update', async () => {
      const res = await withAuth(
        request(BASE_URL).put('/api/v1/products/DOES-NOT-EXIST')
      ).send({ quantity: 1, pick_location: 'A1' });

      expect(res.status).toBe(404);
    });

    it('returns 404 for a non-existent product on delete', async () => {
      const res = await withAuth(
        request(BASE_URL).delete('/api/v1/products/DOES-NOT-EXIST')
      );

      expect(res.status).toBe(404);
    });

    it('returns 404 for an unknown route', async () => {
      const res = await request(BASE_URL).get('/unknown-route');

      expect(res.status).toBe(404);
    });

    it('never leaks a stack trace to the client', async () => {
      const res = await withAuth(
        request(BASE_URL).get('/api/v1/products/DOES-NOT-EXIST')
      );

      expect(res.body.errorStack).toBeUndefined();
    });
  });
});
