import { Module } from '@nestjs/common';

// Using require avoids occasional TS Server false negatives resolving local modules on fresh workspace bootstrap.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { HealthController } = require('./health.controller');

@Module({
  controllers: [HealthController],
})
export class AppModule {}
