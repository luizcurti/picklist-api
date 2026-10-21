import { AsyncLocalStorage } from 'async_hooks';

interface RequestStore {
  requestId: string;
}

const als = new AsyncLocalStorage<RequestStore>();

function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return als.run({ requestId }, fn);
}

function getRequestId(): string | undefined {
  return als.getStore()?.requestId;
}

export { runWithRequestId, getRequestId };
