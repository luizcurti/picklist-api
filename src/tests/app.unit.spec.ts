import request from 'supertest';
import type { App as AppType } from '@shared/infra/app';

const getReadinessMock = jest.fn();
jest.mock('@shared/infra/http/health/readiness', () => ({
  getReadiness: (...args: unknown[]) => getReadinessMock(...args),
}));

describe('App CORS configuration', () => {
  const originalCorsOrigin = process.env.CORS_ORIGIN;

  afterEach(() => {
    process.env.CORS_ORIGIN = originalCorsOrigin;
    jest.resetModules();
  });

  it('reflects a configured origin instead of allowing any origin', async () => {
    process.env.CORS_ORIGIN = 'https://example.com';
    jest.resetModules();
    const { App } = await import('@shared/infra/app');

    const app: AppType = new App();
    await app.init();

    const res = await request(app.server)
      .get('/health')
      .set('Origin', 'https://example.com');

    expect(res.headers['access-control-allow-origin']).toBe(
      'https://example.com'
    );
  });

  it('sends a literal wildcard, not a reflected origin, when CORS_ORIGIN=*', async () => {
    // Regression guard for the CodeQL CORS-misconfiguration finding: a
    // reflected origin (`origin: true`) would echo back whatever Origin
    // header the caller sends instead of this static '*'.
    process.env.CORS_ORIGIN = '*';
    jest.resetModules();
    const { App } = await import('@shared/infra/app');

    const app: AppType = new App();
    await app.init();

    const res = await request(app.server)
      .get('/health')
      .set('Origin', 'https://attacker.example');

    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});

describe('App /health/ready', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('returns 503 with status degraded when not ready', async () => {
    getReadinessMock.mockResolvedValue({
      ready: false,
      checks: { storage: 'error', rabbitmq: 'ok' },
    });
    const { App } = await import('@shared/infra/app');
    const app: AppType = new App();
    await app.init();

    const res = await request(app.server).get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      status: 'degraded',
      checks: { storage: 'error', rabbitmq: 'ok' },
    });
  });

  it('returns 200 with status ok when ready', async () => {
    getReadinessMock.mockResolvedValue({
      ready: true,
      checks: { storage: 'ok', rabbitmq: 'ok' },
    });
    const { App } = await import('@shared/infra/app');
    const app: AppType = new App();
    await app.init();

    const res = await request(app.server).get('/health/ready');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      checks: { storage: 'ok', rabbitmq: 'ok' },
    });
  });
});

describe('App trust proxy', () => {
  const originalTrustProxy = process.env.TRUST_PROXY;

  afterEach(() => {
    if (originalTrustProxy === undefined) {
      delete process.env.TRUST_PROXY;
    } else {
      process.env.TRUST_PROXY = originalTrustProxy;
    }
    jest.resetModules();
  });

  it('trusts no proxy by default', async () => {
    delete process.env.TRUST_PROXY;
    jest.resetModules();
    const { App } = await import('@shared/infra/app');
    const app: AppType = new App();
    await app.init();

    expect(app.server.get('trust proxy')).toBe(false);
  });

  it('trusts the configured number of hops when TRUST_PROXY is set', async () => {
    process.env.TRUST_PROXY = '2';
    jest.resetModules();
    const { App } = await import('@shared/infra/app');
    const app: AppType = new App();
    await app.init();

    expect(app.server.get('trust proxy')).toBe(2);
  });
});
