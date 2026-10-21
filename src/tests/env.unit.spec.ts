describe('env', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiKeys = process.env.API_KEYS;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.API_KEYS = originalApiKeys;
    jest.resetModules();
  });

  it('refuses to start when NODE_ENV=production and API_KEYS is unset', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.API_KEYS;
    jest.resetModules();

    await expect(import('@config/env')).rejects.toThrow('API_KEYS must be set');
  });

  it('falls back to the default dev key outside production when API_KEYS is unset', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.API_KEYS;
    jest.resetModules();

    const { env, DEFAULT_DEV_API_KEY } = await import('@config/env');

    expect(env.apiKeys).toEqual([DEFAULT_DEV_API_KEY]);
    expect(env.usingDefaultApiKey).toBe(true);
  });

  it('uses the configured keys when API_KEYS is set, even in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.API_KEYS = 'key-a, key-b';
    jest.resetModules();

    const { env } = await import('@config/env');

    expect(env.apiKeys).toEqual(['key-a', 'key-b']);
    expect(env.usingDefaultApiKey).toBe(false);
  });
});
