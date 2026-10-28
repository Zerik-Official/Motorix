/**
 * @file Data access for the `refresh_tokens` table.
 */

import type { PrismaClient } from "../generated/prisma/client";

/**
 * Refresh token stored in `refresh_tokens`; only the hash of the token is kept.
 */
export interface RefreshTokenRecord {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
  replacedBy: string | null;
}

/**
 * Data required to store a refresh token.
 */
export interface NewRefreshToken {
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
}

/**
 * Stores, rotates and revokes refresh tokens.
 */
export interface RefreshTokenRepository {
  /**
   * @param data - Token to store.
   * @returns The stored token.
   */
  create(data: NewRefreshToken): Promise<RefreshTokenRecord>;

  /**
   * @param tokenHash - SHA-256 hex digest of the token.
   * @returns The stored token, or null.
   */
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;

  /**
   * Revokes a token and stores its successor, only if the token was still active.
   *
   * The revocation is a conditional update, so two requests racing with the same token cannot both
   * rotate it: the second one finds it already revoked.
   *
   * @param currentId - Identifier of the token being used.
   * @param next - Successor in the same family.
   * @returns The successor, or null when the token had already been revoked.
   */
  rotate(currentId: string, next: NewRefreshToken): Promise<RefreshTokenRecord | null>;

  /**
   * @param familyId - Family whose active tokens are revoked.
   */
  revokeFamily(familyId: string): Promise<void>;

  /**
   * @param userId - Account whose active tokens are revoked.
   */
  revokeAllForUser(userId: string): Promise<void>;
}

/**
 * Refresh token repository backed by Prisma.
 */
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  /**
   * @param client - Prisma client of the service.
   */
  constructor(private readonly client: PrismaClient) {}

  /**
   * @param data - Token to store.
   * @returns The stored token.
   */
  create(data: NewRefreshToken): Promise<RefreshTokenRecord> {
    return this.client.refreshToken.create({ data });
  }

  /**
   * @param tokenHash - SHA-256 hex digest of the token.
   * @returns The stored token, or null.
   */
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return this.client.refreshToken.findUnique({ where: { tokenHash } });
  }

  /**
   * @param currentId - Identifier of the token being used.
   * @param next - Successor in the same family.
   * @returns The successor, or null when the token had already been revoked.
   */
  rotate(currentId: string, next: NewRefreshToken): Promise<RefreshTokenRecord | null> {
    const successorId: string = crypto.randomUUID();
    return this.client.$transaction(async (transaction) => {
      const revoked: { count: number } = await transaction.refreshToken.updateMany({
        where: { id: currentId, revokedAt: null },
        data: { revokedAt: new Date(), replacedBy: successorId },
      });
      if (revoked.count === 0) {
        return null;
      }
      return transaction.refreshToken.create({ data: { ...next, id: successorId } });
    });
  }

  /**
   * @param familyId - Family whose active tokens are revoked.
   */
  async revokeFamily(familyId: string): Promise<void> {
    await this.client.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  /**
   * @param userId - Account whose active tokens are revoked.
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.client.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
