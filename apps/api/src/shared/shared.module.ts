import { Global, Module } from '@nestjs/common';
import { ENV, loadEnv } from './env.js';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: loadEnv }, PrismaService],
  exports: [ENV, PrismaService],
})
export class SharedModule {}
