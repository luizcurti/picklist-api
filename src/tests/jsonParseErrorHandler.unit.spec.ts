import { Request, Response } from 'express';
import { jsonParseErrorHandler } from '@shared/infra/http/middlewares/jsonParseErrorHandler';

function buildResponse(): Partial<Response> {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('jsonParseErrorHandler', () => {
  it('responds with a consistent JSON error for a body-parser JSON parse failure', () => {
    const err = Object.assign(new SyntaxError('Unexpected token'), {
      type: 'entity.parse.failed',
    });
    const res = buildResponse();
    const next = jest.fn();

    jsonParseErrorHandler(err, {} as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Malformed JSON in request body',
      type: 'VALIDATION_FAILED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through a SyntaxError that is not a body-parser JSON failure', () => {
    const err = new SyntaxError('some unrelated syntax error');
    const res = buildResponse();
    const next = jest.fn();

    jsonParseErrorHandler(err, {} as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('passes through any non-SyntaxError error unchanged', () => {
    const err = new Error('something else entirely');
    const res = buildResponse();
    const next = jest.fn();

    jsonParseErrorHandler(err, {} as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});
