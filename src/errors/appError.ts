export class AppError extends Error {
  public readonly code: number;
  public readonly type: string;
  public readonly data: unknown;

  constructor(
    message = '',
    code = 400,
    type = 'Bad Request',
    data: unknown = {}
  ) {
    super(message);
    this.code = code;
    this.type = type;
    this.data = data;
    this.name = 'AppError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}
