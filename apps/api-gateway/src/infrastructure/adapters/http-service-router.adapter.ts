import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ServiceRouterPort, ForwardRequestConfig, ForwardResponse } from '../../domain/ports';
import { serviceUrls } from '../config/services.config';

interface AxiosResponse {
  status: number;
  data: unknown;
  headers: Record<string, string>;
}

@Injectable()
export class HttpServiceRouterAdapter implements ServiceRouterPort {
  private readonly logger = new Logger(HttpServiceRouterAdapter.name);
  private readonly timeout = 10000;

  constructor(
    private readonly httpService: HttpService,
  ) {}

  async forwardRequest(config: ForwardRequestConfig): Promise<ForwardResponse> {
    const { service, path, method, headers, body } = config;

    const baseUrl = serviceUrls[service];
    if (!baseUrl) {
      this.logger.error(`No URL configured for service: ${service}`);
      return {
        statusCode: 502,
        body: { error: 'Bad Gateway', message: `Service ${service} not available` },
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const url = `${baseUrl}${path}`;
    const requestHeaders = {
      ...headers,
      'X-Forwarded-For': headers['x-forwarded-for'] || headers['host'] || 'unknown',
      'X-Gateway-Timestamp': Date.now().toString(),
    };

    try {
      let response: AxiosResponse;

      switch (method.toUpperCase()) {
        case 'GET': {
          const res = await firstValueFrom(
            this.httpService.get(url, { headers: requestHeaders, timeout: this.timeout })
          );
          response = { status: res.status, data: res.data, headers: res.headers as Record<string, string> };
          break;
        }
        case 'POST': {
          const res = await firstValueFrom(
            this.httpService.post(url, body, { headers: requestHeaders, timeout: this.timeout })
          );
          response = { status: res.status, data: res.data, headers: res.headers as Record<string, string> };
          break;
        }
        case 'PATCH':
        case 'PUT': {
          const res = await firstValueFrom(
            this.httpService.patch(url, body, { headers: requestHeaders, timeout: this.timeout })
          );
          response = { status: res.status, data: res.data, headers: res.headers as Record<string, string> };
          break;
        }
        case 'DELETE': {
          const res = await firstValueFrom(
            this.httpService.delete(url, { headers: requestHeaders, timeout: this.timeout })
          );
          response = { status: res.status, data: res.data, headers: res.headers as Record<string, string> };
          break;
        }
        default: {
          const res = await firstValueFrom(
            this.httpService.request({
              url,
              method: method.toLowerCase(),
              data: body,
              headers: requestHeaders,
              timeout: this.timeout,
            })
          );
          response = { status: res.status, data: res.data, headers: res.headers as Record<string, string> };
        }
      }

      return {
        statusCode: response.status,
        body: response.data,
        headers: {
          'Content-Type': 'application/json',
        },
      };
    } catch (error: unknown) {
      const err = error as { response?: { status: number; data: unknown; headers: Record<string, string> }; code?: string; message?: string };
      this.logger.error(`Forward request failed: ${err.message}`);

      if (err.response) {
        return {
          statusCode: err.response.status,
          body: err.response.data,
          headers: { 'Content-Type': 'application/json' },
        };
      }

      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        return {
          statusCode: 504,
          body: { error: 'Gateway Timeout', message: `Service ${service} unreachable` },
          headers: { 'Content-Type': 'application/json' },
        };
      }

      return {
        statusCode: 502,
        body: { error: 'Bad Gateway', message: err.message },
        headers: { 'Content-Type': 'application/json' },
      };
    }
  }
}