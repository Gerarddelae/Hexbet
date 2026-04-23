import { All, Req, Res, Param, Logger, Controller, Inject } from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyRequestUseCase } from '../../application/use-cases/proxy-request.use-case';

@Controller()
export class GatewayController {
  private readonly logger = new Logger(GatewayController.name);

  constructor(
    @Inject(ProxyRequestUseCase) private readonly proxyRequestUseCase: ProxyRequestUseCase,
  ) {}

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