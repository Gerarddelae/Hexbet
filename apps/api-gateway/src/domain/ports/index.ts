export interface AuthPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export interface AuthProviderPort {
  validateToken(token: string): Promise<AuthPayload | null>;
  generateToken(payload: Omit<AuthPayload, 'iat' | 'exp'>): Promise<string>;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimiterPort {
  isAllowed(key: string, config: RateLimitConfig): Promise<boolean>;
  getRemaining(key: string): Promise<number>;
  reset(key: string): Promise<void>;
}

export interface ServiceRouterPort {
  forwardRequest(config: ForwardRequestConfig): Promise<ForwardResponse>;
}

export interface ForwardRequestConfig {
  service: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface ForwardResponse {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
}

export interface RouteConfig {
  path: string;
  service: string;
  targetService: string;
  methods: string[];
  auth: boolean;
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
}

export interface ProxyRequestDto {
  service: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
  authToken?: string;
}

export const AUTH_PROVIDER_PORT = 'AUTH_PROVIDER_PORT';
export const RATE_LIMITER_PORT = 'RATE_LIMITER_PORT';
export const SERVICE_ROUTER_PORT = 'SERVICE_ROUTER_PORT';