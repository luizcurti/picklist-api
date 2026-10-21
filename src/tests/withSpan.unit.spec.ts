import { withSpan } from '@shared/infra/tracing/withSpan';

describe('withSpan', () => {
  it('resolves and returns the wrapped value', async () => {
    const result = await withSpan('test.success', async () => 'ok');

    expect(result).toBe('ok');
  });

  it('rethrows the original error when the wrapped function fails', async () => {
    const error = new Error('boom');

    await expect(
      withSpan('test.failure', async () => {
        throw error;
      })
    ).rejects.toThrow('boom');
  });
});
