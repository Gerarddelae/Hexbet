import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { httpRequestDuration, httpRequestTotal } from './index';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MetricsInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const startTime = Date.now();
    const { method, path } = request;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = (Date.now() - startTime) / 1000;
          const statusCode = response.statusCode.toString();

          httpRequestDuration.labels(method, path, statusCode).observe(duration);
          httpRequestTotal.labels(method, path, statusCode).inc();
        },
        error: (error: { status?: number }) => {
          const duration = (Date.now() - startTime) / 1000;
          const statusCode = (error?.status || 500).toString();

          httpRequestDuration.labels(method, path, statusCode).observe(duration);
          httpRequestTotal.labels(method, path, statusCode).inc();
        },
      }),
    );
  }
}