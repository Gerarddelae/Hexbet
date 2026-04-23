import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { GatewayController } from './interface/http/gateway.controller';
import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';
import { OddsStreamGateway } from './interface/websocket/odds-stream.gateway';
import { ProxyRequestUseCase } from './application/use-cases/proxy-request.use-case';
import { JwtAuthAdapter } from './infrastructure/adapters/jwt-auth.adapter';
import { HttpServiceRouterAdapter } from './infrastructure/adapters/http-service-router.adapter';
import { RedisRateLimiterAdapter } from './infrastructure/adapters/redis-rate-limiter.adapter';
import { MetricsInterceptor } from '@betting-engine/observability';
import { jwtConfig } from './infrastructure/config/services.config';
import { AUTH_PROVIDER_PORT, JWT_AUTH_ADAPTER, RATE_LIMITER_PORT, SERVICE_ROUTER_PORT } from './domain/ports';

@Module({
  imports: [
    HttpModule,
    JwtModule.register({
      secret: jwtConfig.secret,
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [
    GatewayController,
    HealthController,
    MetricsController,
  ],
  providers: [
    ProxyRequestUseCase,
    OddsStreamGateway,
    HttpServiceRouterAdapter,
    JwtAuthAdapter,
    {
      provide: JWT_AUTH_ADAPTER,
      useClass: JwtAuthAdapter,
    },
    {
      provide: AUTH_PROVIDER_PORT,
      useClass: JwtAuthAdapter,
    },
    {
      provide: SERVICE_ROUTER_PORT,
      useClass: HttpServiceRouterAdapter,
    },
    {
      provide: RATE_LIMITER_PORT,
      useClass: RedisRateLimiterAdapter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}