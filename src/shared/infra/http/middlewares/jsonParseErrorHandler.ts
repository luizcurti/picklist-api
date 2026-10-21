import { NextFunction, Request, Response } from 'express';

// express.json() throws before /api/v1 is entered, so handlingErrors there
// never sees it — same root cause as the apiKeyAuth fix.
export function jsonParseErrorHandler(
  err: Error,
  _request: Request,
  response: Response,
  next: NextFunction
) {
  // body-parser's signal for a parse failure — checked via `err.type`, not
  // just `instanceof`, to avoid misclassifying an unrelated SyntaxError.
  const isJsonParseError =
    err instanceof SyntaxError &&
    (err as SyntaxError & { type?: string }).type === 'entity.parse.failed';

  if (isJsonParseError) {
    return response.status(400).json({
      message: 'Malformed JSON in request body',
      type: 'VALIDATION_FAILED',
    });
  }

  next(err);
}
