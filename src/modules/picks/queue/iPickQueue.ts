interface IPickEvent {
  pickId: string;
  product_code: string;
  quantity: number;
  pick_location: string;
}

type PickFailureReason = 'PRODUCT_NOT_FOUND' | 'INSUFFICIENT_STOCK';

interface IPickFailedEvent extends IPickEvent {
  reason: PickFailureReason;
}

interface IPickQueue {
  publishPickCreated(event: IPickEvent): Promise<void>;
  publishPickCompleted(event: IPickEvent): Promise<void>;
  publishPickFailed(event: IPickFailedEvent): Promise<void>;
}

export { IPickQueue, IPickEvent, IPickFailedEvent, PickFailureReason };
