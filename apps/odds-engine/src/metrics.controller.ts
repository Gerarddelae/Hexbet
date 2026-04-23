import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { getMetrics } from '@betting-engine/observability';

@Controller('metrics')
export class MetricsController {
  @Get()
  async metrics(@Res() res: Response): Promise<void> {
    const metrics = await getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  }
}