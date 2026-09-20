import { Injectable } from '@nestjs/common';
import type { User as UserRecord } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/prisma.service.js';
import { User } from '../domain/user.js';
import { UserRepository } from '../domain/user.repository.js';

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string) {
    return toDomain(await this.prisma.user.findUnique({ where: { id } }));
  }

  async findByUsername(username: string) {
    return toDomain(await this.prisma.user.findUnique({ where: { username } }));
  }

  async findFirst() {
    return toDomain(await this.prisma.user.findFirst({ orderBy: { createdAt: 'asc' } }));
  }

  async save(user: User) {
    const data = {
      username: user.username,
      passwordHash: user.passwordHash,
      displayName: user.displayName,
      tokenVersion: user.tokenVersion,
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
    };
    await this.prisma.user.upsert({
      where: { id: user.id },
      create: { id: user.id, ...data },
      update: data,
    });
  }

  async saveLastLogin(user: User) {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: user.lastLoginAt, lastLoginIp: user.lastLoginIp },
    });
  }
}

function toDomain(record: UserRecord | null): User | null {
  if (!record) return null;
  return User.restore({
    id: record.id,
    username: record.username,
    passwordHash: record.passwordHash,
    displayName: record.displayName,
    tokenVersion: record.tokenVersion,
    lastLoginAt: record.lastLoginAt,
    lastLoginIp: record.lastLoginIp,
  });
}
