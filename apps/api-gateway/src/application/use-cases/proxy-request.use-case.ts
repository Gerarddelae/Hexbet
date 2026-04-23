import { Injectable, Inject, Logger, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import {
  AuthProviderPort,
  RateLimiterPort,
  ServiceRouterPort,
  ProxyRequestDto,
  ForwardResponse,
  RateLimitConfig,
  RouteConfig,
  AUTH_PROVIDER_PORT,
  RATE_LIMITER_PORT,
  SERVICE_ROUTER_PORT,
} from '../../domain/ports';
import { routes } from '../../infrastructure/config/services.config';

@Injectable()
export class ProxyRequestUseCase {
  private readonly logger = new Logger(ProxyRequestUseCase.name);

  constructor(
    @Inject(AUTH_PROVIDER_PORT)
    private readonly authProvider: AuthProviderPort,
    @Inject(RATE_LIMITER_PORT)
    private readonly rateLimiter: RateLimiterPort,
    @Inject(SERVICE_ROUTER_PORT)
    private readonly serviceRouter: ServiceRouterPort,
  ) {}

  async execute(dto: ProxyRequestDto): Promise<ForwardResponse> {
    const { service, path, method, headers, body, authToken } = dto;

    const route = this.findRoute(service, path, method);
    if (!route) {
      throw new ForbiddenException(`No route configured for ${method} ${path}`);
    }

    if (route.auth && !authToken) {
      throw new UnauthorizedException('Authentication required');
    }

    if (route.auth && authToken) {
      const token = authToken.replace('Bearer ', '');
      const payload = await this.authProvider.validateToken(token);
      if (!payload) {
        throw new UnauthorizedException('Invalid token');
      }
    }

    const rateLimitKey = `ratelimit:${service}:${path}`;
    const rateLimitConfig = this.getRateLimitConfig(route, path);
    const allowed = await this.rateLimiter.isAllowed(rateLimitKey, rateLimitConfig);

    if (!allowed) {
      return {
        statusCode: 429,
        body: { error: 'Too Many Requests', message: 'Rate limit exceeded' },
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const response = await this.serviceRouter.forwardRequest({
      service: route.targetService,
      path,
      method,
      headers: this.sanitizeHeaders(headers),
      body,
    });

    const remaining = await this.rateLimiter.getRemaining(rateLimitKey);
    response.headers['X-RateLimit-Remaining'] = remaining.toString();

    return response;
  }

  private findRoute(service: string, path: string, method: string): RouteConfig | null {
    return routes.find((route) => {
      if (route.service !== service && route.service !== '*') {
        return false;
      }

      const pattern = route.path.replace(/\*/g, '.*').replace(/\?/g, '[^/]');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(path);
    }) ?? null;
  }

  private getRateLimitConfig(route: RouteConfig, path: string): RateLimitConfig {
    if (route.rateLimit) {
      return route.rateLimit;
    }

    if (path.includes('/bets')) {
      return { windowMs: 60000, maxRequests: 10 };
    }
    if (path.includes('/matches/live')) {
      return { windowMs: 60000, maxRequests: 100 };
    }

    return { windowMs: 60000, maxRequests: 60 };
  }

  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    delete sanitized['host'];
    delete sanitized['content-length'];
    return sanitized;
  }
}