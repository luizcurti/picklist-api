export interface IRequest {
  product_code: string;
  quantity?: number;
  quantity_delta?: number;
  pick_location: string;
}
