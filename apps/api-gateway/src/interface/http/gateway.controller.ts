import { All, Req, Res, Param, Logger, Controller, Inject } from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyRequestUseCase } from '../../application/use-cases/proxy-request.use-case';
import { JwtAuthAdapter } from '../../infrastructure/adapters/jwt-auth.adapter';
import { JWT_AUTH_ADAPTER } from '../../domain/ports';

@Controller()
export class GatewayController {
  private readonly logger = new Logger(GatewayController.name);

  constructor(
    @Inject(ProxyRequestUseCase) private readonly proxyRequestUseCase: ProxyRequestUseCase,
    @Inject(JWT_AUTH_ADAPTER) private readonly jwtAuthAdapter: JwtAuthAdapter,
  ) {}

  @All('auth/token')
  async handleAuthToken(@Req() req: Request, @Res() res: Response): Promise<void> {
    this.logger.log(`Auth token request: ${req.method} - body: ${JSON.stringify(req.body)}`);

    if (req.method === 'POST') {
      try {
        const { userId, email } = req.body;
        this.logger.log(`Generating token for userId: ${userId}, email: ${email}`);
        
        if (!userId || !email) {
          res.status(400).json({ error: 'userId and email are required' });
          return;
        }

        const token = await this.jwtAuthAdapter.generateToken({ userId, email });
        this.logger.log(`Token generated successfully`);
        res.status(201).json({ token });
        return;
      } catch (error) {
        this.logger.error(`Error generating token: ${error}`);
        res.status(500).json({ error: 'Failed to generate token', details: String(error) });
        return;
      }
    }

    res.status(404).json({ error: 'Not found' });
  }

  @All(':service/*')
  async proxyRequest(
    @Param('service') service: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const path = req.path.substring(service.length + 1);
    this.logger.log(`Proxying ${req.method} ${path} to ${service}`);

    try {
      const response = await this.proxyRequestUseCase.execute({
        service,
        path,
        method: req.method,
        headers: req.headers as Record<string, string>,
        body: req.body,
        authToken: req.headers.authorization,
      });

      res.status(response.statusCode).json(response.body);
    } catch (error: unknown) {
      this.logger.error(`Proxy error: ${error}`);
      const err = error as { status?: number; message?: string };
      const statusCode = err.status ?? 500;
      const message = err?.message ?? 'Internal Server Error';

      res.status(statusCode).json({ error: message });
    }
  }
}