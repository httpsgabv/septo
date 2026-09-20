import type { NextFunction, Request, Response } from 'express';
import type { ErrorResponse } from './error-response.schema.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF defense with `SameSite=Lax`: a cross-site HTML form can only send urlencoded, multipart or
 * text/plain bodies, so refusing anything but JSON on mutations shuts that door.
 */
export function requireJsonBody(req: Request, res: Response, next: NextFunction) {
  // Bodyless mutations (e.g. logout) are fine; `is()` alone would treat `Content-Length: 0` as a body.
  const hasContent =
    Number(req.headers['content-length']) > 0 || req.headers['transfer-encoding'] !== undefined;
  if (MUTATING.has(req.method) && hasContent && !req.is('application/json')) {
    const body: ErrorResponse = {
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'Request bodies must be application/json',
    };
    res.status(415).json(body);
    return;
  }
  next();
}
