interface IRequest {
  product_code: string;
  quantity: number;
  pick_location: string;
  idempotencyKey?: string;
}

interface IResponse {
  pickId: string;
}

export { IRequest, IResponse };
