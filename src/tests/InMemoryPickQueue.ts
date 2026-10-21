import {
  IPickEvent,
  IPickFailedEvent,
  IPickQueue,
} from '@modules/picks/queue/iPickQueue';

export class InMemoryPickQueue implements IPickQueue {
  public created: IPickEvent[] = [];
  public completed: IPickEvent[] = [];
  public failed: IPickFailedEvent[] = [];

  async publishPickCreated(event: IPickEvent): Promise<void> {
    this.created.push(event);
  }

  async publishPickCompleted(event: IPickEvent): Promise<void> {
    this.completed.push(event);
  }

  async publishPickFailed(event: IPickFailedEvent): Promise<void> {
    this.failed.push(event);
  }
}
