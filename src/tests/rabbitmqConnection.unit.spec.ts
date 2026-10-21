export {};

const connectMock = jest.fn();

jest.mock('amqplib', () => ({
  __esModule: true,
  default: { connect: (...args: unknown[]) => connectMock(...args) },
  connect: (...args: unknown[]) => connectMock(...args),
}));

async function freshConnectionModule() {
  jest.resetModules();
  // logger is re-imported from the same fresh module registry as
  // connection.ts — spying on the copy imported at file-scope (before
  // resetModules) would miss every call connection.ts makes to its own,
  // separate instance.
  const { logger } = await import('@shared/utils/logger');
  const connection =
    await import('@shared/infra/messaging/rabbitmq/connection');
  return { ...connection, logger };
}

describe('rabbitmq connection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reuses the cached connection instead of reconnecting', async () => {
    connectMock.mockResolvedValue({
      createChannel: jest.fn().mockResolvedValue({}),
      on: jest.fn(),
    });
    const { getConnection } = await freshConnectionModule();

    await getConnection();
    await getConnection();

    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  it('retries on the next call after a failed connection attempt', async () => {
    connectMock
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValueOnce({ createChannel: jest.fn(), on: jest.fn() });
    const { getConnection } = await freshConnectionModule();

    await expect(getConnection()).rejects.toThrow('connection refused');
    await expect(getConnection()).resolves.toBeDefined();

    expect(connectMock).toHaveBeenCalledTimes(2);
  });

  it('getChannel reuses the cached channel instead of reconnecting', async () => {
    const createChannel = jest.fn().mockResolvedValue({ id: 'channel' });
    connectMock.mockResolvedValue({ createChannel, on: jest.fn() });
    const { getChannel } = await freshConnectionModule();

    await getChannel();
    await getChannel();

    expect(createChannel).toHaveBeenCalledTimes(1);
  });

  it('getChannel retries on the next call after a failure, reusing the already-open connection', async () => {
    const createChannel = jest
      .fn()
      .mockRejectedValueOnce(new Error('no channel'))
      .mockResolvedValueOnce({ id: 'channel' });
    connectMock.mockResolvedValue({ createChannel, on: jest.fn() });
    const { getChannel } = await freshConnectionModule();

    await expect(getChannel()).rejects.toThrow('no channel');
    await expect(getChannel()).resolves.toEqual({ id: 'channel' });
    // The connection itself never failed, so it's only ever established once.
    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  it('logs and exits when an established connection errors out', async () => {
    let errorHandler: ((error: unknown) => void) | undefined;
    connectMock.mockResolvedValue({
      createChannel: jest.fn(),
      on: (event: string, handler: (error: unknown) => void) => {
        if (event === 'error') errorHandler = handler;
      },
    });
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const { getConnection, logger } = await freshConnectionModule();
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});

    await getConnection();
    errorHandler?.(new Error('socket hang up'));

    expect(errorSpy).toHaveBeenCalledWith('RabbitMQ connection error', {
      error: 'socket hang up',
    });
    expect(exitSpy).toHaveBeenCalledWith(1);

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('stringifies a non-Error value passed to the connection error handler', async () => {
    let errorHandler: ((error: unknown) => void) | undefined;
    connectMock.mockResolvedValue({
      createChannel: jest.fn(),
      on: (event: string, handler: (error: unknown) => void) => {
        if (event === 'error') errorHandler = handler;
      },
    });
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const { getConnection, logger } = await freshConnectionModule();
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});

    await getConnection();
    errorHandler?.('a plain string failure');

    expect(errorSpy).toHaveBeenCalledWith('RabbitMQ connection error', {
      error: 'a plain string failure',
    });

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
