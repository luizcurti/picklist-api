import request from 'supertest';

/**
 * Local-only proof of the full async pick flow across real processes
 * (api + rabbitmq + inventory-worker + audit-worker). Not part of `npm
 * test` or any CI-blocking script — more moving services means more
 * startup-ordering flake surface than the CRUD e2e suite, so this stays a
 * script a developer runs on demand:
 *
 *   docker compose --profile messaging up -d --build
 *   npm run test:messaging
 *   docker compose --profile messaging down
 */
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3005';
// A literal duplicate of env.ts's DEFAULT_DEV_API_KEY — see api.e2e.spec.ts.
const API_KEY = process.env.E2E_API_KEY || 'dev-local-key';

jest.setTimeout(30000);

function withAuth<T extends request.Test>(req: T): T {
  return req.set('X-API-Key', API_KEY) as T;
}

async function waitFor<T>(
  fn: () => Promise<T | undefined>,
  timeoutMs = 15000,
  intervalMs = 500
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await fn();
    if (result !== undefined) return result;
    if (Date.now() > deadline) {
      throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

describe('Async pick flow (messaging profile, local-only)', () => {
  const productCode = `PICK-MSG-${Date.now()}`;

  beforeAll(async () => {
    await withAuth(request(BASE_URL).post('/api/v1/products')).send({
      product_code: productCode,
      quantity: 10,
      pick_location: 'A1',
    });
  });

  afterAll(async () => {
    await withAuth(request(BASE_URL).delete(`/api/v1/products/${productCode}`));
  });

  it('decrements stock asynchronously after a pick is accepted', async () => {
    const createRes = await withAuth(
      request(BASE_URL).post('/api/v1/picks')
    ).send({ product_code: productCode, quantity: 4, pick_location: 'A1' });

    expect(createRes.status).toBe(202);
    expect(createRes.body.pickId).toEqual(expect.any(String));

    const updatedQuantity = await waitFor(async () => {
      const res = await withAuth(
        request(BASE_URL).get(`/api/v1/products/${productCode}`)
      );
      return res.body.quantity === 6 ? res.body.quantity : undefined;
    });

    expect(updatedQuantity).toBe(6);
  });

  it('does not double-process a repeated Idempotency-Key', async () => {
    const idempotencyKey = `msg-key-${Date.now()}`;
    const payload = {
      product_code: productCode,
      quantity: 1,
      pick_location: 'A1',
    };

    const first = await withAuth(request(BASE_URL).post('/api/v1/picks'))
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);
    const second = await withAuth(request(BASE_URL).post('/api/v1/picks'))
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(first.body.pickId).toBe(second.body.pickId);

    await waitFor(async () => {
      const res = await withAuth(
        request(BASE_URL).get(`/api/v1/products/${productCode}`)
      );
      return res.body.quantity === 5 ? res.body.quantity : undefined;
    });

    // A second wait confirms it settles at 5 and never drifts to 4 from a
    // duplicate decrement.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const finalRes = await withAuth(
      request(BASE_URL).get(`/api/v1/products/${productCode}`)
    );
    expect(finalRes.body.quantity).toBe(5);
  });
});
