const poolQueryMock = jest.fn();
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: (...args: unknown[]) => poolQueryMock(...args),
    on: jest.fn(),
  })),
}));

const amqplibConnectMock = jest.fn();
jest.mock('amqplib', () => ({
  __esModule: true,
  default: { connect: (...args: unknown[]) => amqplibConnectMock(...args) },
  connect: (...args: unknown[]) => amqplibConnectMock(...args),
}));

async function freshReadiness() {
  jest.resetModules();
  return import('@shared/infra/http/health/readiness');
}

describe('getReadiness', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('is ready when postgres is queryable and rabbitmq is reachable', async () => {
    poolQueryMock.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    amqplibConnectMock.mockResolvedValue({
      createChannel: jest.fn().mockResolvedValue({}),
      on: jest.fn(),
    });

    const { getReadiness } = await freshReadiness();
    const result = await getReadiness();

    expect(poolQueryMock).toHaveBeenCalledWith('SELECT 1');
    expect(result).toEqual({
      ready: true,
      checks: { storage: 'ok', rabbitmq: 'ok' },
    });
  });

  it('is not ready when the postgres query fails', async () => {
    poolQueryMock.mockRejectedValue(new Error('connection terminated'));
    amqplibConnectMock.mockResolvedValue({
      createChannel: jest.fn().mockResolvedValue({}),
      on: jest.fn(),
    });

    const { getReadiness } = await freshReadiness();
    const result = await getReadiness();

    expect(result.ready).toBe(false);
    expect(result.checks.storage).toBe('error');
  });

  it('stays ready when rabbitmq is unreachable but storage is fine', async () => {
    poolQueryMock.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    amqplibConnectMock.mockRejectedValue(new Error('connection refused'));

    const { getReadiness } = await freshReadiness();
    const result = await getReadiness();

    expect(result.ready).toBe(true);
    expect(result.checks.rabbitmq).toBe('error');
  });

  it('reports storage error when the postgres query hangs past the timeout', async () => {
    jest.useFakeTimers();
    poolQueryMock.mockReturnValue(new Promise(() => {})); // never settles
    amqplibConnectMock.mockResolvedValue({
      createChannel: jest.fn().mockResolvedValue({}),
      on: jest.fn(),
    });

    const { getReadiness } = await freshReadiness();
    const resultPromise = getReadiness();
    await jest.advanceTimersByTimeAsync(2000);
    const result = await resultPromise;

    expect(result.checks.storage).toBe('error');
  });
});
