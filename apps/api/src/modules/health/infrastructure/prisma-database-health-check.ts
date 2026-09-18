import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma.service.js';
import { DatabaseHealthCheck } from '../domain/database-health-check.js';

@Injectable()
export class PrismaDatabaseHealthCheck extends DatabaseHealthCheck {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isUp(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
