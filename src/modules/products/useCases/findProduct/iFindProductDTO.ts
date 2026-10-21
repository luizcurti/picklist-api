export interface IRequest {
  product_code: string;
}

export interface IResponse {
  product_code: string;
  quantity: number;
  pick_location: string;
}
