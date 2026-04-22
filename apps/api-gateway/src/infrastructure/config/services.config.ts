import { RouteConfig } from '../../domain/ports';

export const routes: RouteConfig[] = [
  {
    path: '/matches/**',
    service: 'bet-service',
    targetService: 'bet-service',
    methods: ['GET'],
    auth: false,
    rateLimit: { windowMs: 60000, maxRequests: 100 },
  },
  {
    path: '/bets',
    service: 'bet-service',
    targetService: 'bet-service',
    methods: ['GET', 'POST'],
    auth: true,
    rateLimit: { windowMs: 60000, maxRequests: 10 },
  },
  {
    path: '/bets/**',
    service: 'bet-service',
    targetService: 'bet-service',
    methods: ['GET', 'PATCH', 'DELETE'],
    auth: true,
    rateLimit: { windowMs: 60000, maxRequests: 20 },
  },
  {
    path: '/health',
    service: '*',
    targetService: 'bet-service',
    methods: ['GET'],
    auth: false,
  },
  {
    path: '/user/**',
    service: 'bet-service',
    targetService: 'bet-service',
    methods: ['GET'],
    auth: true,
  },
];

export const serviceUrls: Record<string, string> = {
  'bet-service': process.env.BET_SERVICE_URL || 'http://localhost:3002',
  'odds-engine': process.env.ODDS_ENGINE_URL || 'http://localhost:3001',
  settlement: process.env.SETTLEMENT_URL || 'http://localhost:3003',
};

export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'betting-engine-secret-key-change-in-production',
  signOptions: { expiresIn: '24h' },
};