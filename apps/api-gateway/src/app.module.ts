import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { GatewayController } from './interface/http/gateway.controller';
import { HealthController } from './health.controller';
import { OddsStreamGateway } from './interface/websocket/odds-stream.gateway';
import { ProxyRequestUseCase } from './application/use-cases/proxy-request.use-case';
import { JwtAuthAdapter } from './infrastructure/adapters/jwt-auth.adapter';
import { HttpServiceRouterAdapter } from './infrastructure/adapters/http-service-router.adapter';
import { RedisRateLimiterAdapter } from './infrastructure/adapters/redis-rate-limiter.adapter';
import { jwtConfig } from './infrastructure/config/services.config';

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
  ],
  providers: [
    ProxyRequestUseCase,
    OddsStreamGateway,
    {
      provide: 'AuthProviderPort',
      useClass: JwtAuthAdapter,
    },
    {
      provide: 'ServiceRouterPort',
      useClass: HttpServiceRouterAdapter,
    },
    {
      provide: 'RateLimiterPort',
      useClass: RedisRateLimiterAdapter,
    },
  ],
})
export class AppModule {}