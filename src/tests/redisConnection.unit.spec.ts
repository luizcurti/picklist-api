export {};

const connectMock = jest.fn();
const onMock = jest.fn();
// .connect() resolves to the client itself in node-redis — the cache in
// connection.ts relies on that being the resolved value.
const fakeClient = { connect: connectMock, on: onMock };
const createClientMock = jest.fn(() => fakeClient);

jest.mock('redis', () => ({
  createClient: () => createClientMock(),
}));

async function freshConnectionModule() {
  jest.resetModules();
  const { logger } = await import('@shared/utils/logger');
  const connection = await import('@shared/infra/redis/connection');
  return { ...connection, logger };
}

describe('redis connection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reuses the cached client instead of reconnecting', async () => {
    connectMock.mockResolvedValue(fakeClient);
    const { getRedisClient } = await freshConnectionModule();

    await getRedisClient();
    await getRedisClient();

    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  it('retries on the next call after a failed connection attempt', async () => {
    connectMock
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValueOnce(fakeClient);
    const { getRedisClient } = await freshConnectionModule();

    await expect(getRedisClient()).rejects.toThrow('connection refused');
    await expect(getRedisClient()).resolves.toBe(fakeClient);

    expect(createClientMock).toHaveBeenCalledTimes(2);
  });

  it('logs but does not exit when the client errors (it reconnects itself)', async () => {
    connectMock.mockResolvedValue(fakeClient);
    const { getRedisClient, logger } = await freshConnectionModule();
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    await getRedisClient();
    const errorHandler = onMock.mock.calls.find(
      ([event]) => event === 'error'
    )?.[1];
    errorHandler?.(new Error('socket closed'));

    expect(errorSpy).toHaveBeenCalledWith('Redis client error', {
      error: 'socket closed',
    });
    expect(exitSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('stringifies a non-Error value passed to the client error handler', async () => {
    connectMock.mockResolvedValue(fakeClient);
    const { getRedisClient, logger } = await freshConnectionModule();
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});

    await getRedisClient();
    const errorHandler = onMock.mock.calls.find(
      ([event]) => event === 'error'
    )?.[1];
    errorHandler?.('a plain string failure');

    expect(errorSpy).toHaveBeenCalledWith('Redis client error', {
      error: 'a plain string failure',
    });

    errorSpy.mockRestore();
  });
});
