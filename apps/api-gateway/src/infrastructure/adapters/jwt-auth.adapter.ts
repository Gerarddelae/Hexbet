import { Injectable, Logger } from '@nestjs/common';
import { AuthProviderPort, AuthPayload } from '../../domain/ports';
import { jwtConfig } from '../config/services.config';

@Injectable()
export class JwtAuthAdapter implements AuthProviderPort {
  private readonly logger = new Logger(JwtAuthAdapter.name);

  async validateToken(token: string): Promise<AuthPayload | null> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        this.logger.warn('Invalid JWT token format');
        return null;
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

      if (!payload.userId || !payload.email) {
        this.logger.warn('JWT payload missing required fields');
        return null;
      }

      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        this.logger.warn('JWT token expired');
        return null;
      }

      return payload as AuthPayload;
    } catch (error) {
      this.logger.error(`JWT validation failed: ${error}`);
      return null;
    }
  }

  async generateToken(payload: Omit<AuthPayload, 'iat' | 'exp'>): Promise<string> {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url');

    const crypto = require('crypto');
    const signature = crypto
      .createHmac('sha256', jwtConfig.secret)
      .update(`${header}.${payloadB64}`)
      .digest('base64url');

    return `${header}.${payloadB64}.${signature}`;
  }
}