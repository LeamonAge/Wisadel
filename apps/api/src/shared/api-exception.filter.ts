import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : null;
    const message = typeof payload === 'string' ? payload : (payload as any)?.message ?? '服务器内部错误';
    const requestId = request.header('x-request-id') ?? randomUUID();

    response.status(status).json({
      code: status === 500 ? 'INTERNAL_ERROR' : `HTTP_${status}`,
      message: Array.isArray(message) ? message.join('; ') : message,
      requestId
    });
  }
}
