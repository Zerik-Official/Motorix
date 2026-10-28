-- CreateEnum
CREATE TYPE "role" AS ENUM ('root', 'admin', 'user');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "role" NOT NULL DEFAULT 'user',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role" "role" NOT NULL,
    "permission" VARCHAR(64) NOT NULL,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role","permission")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- There is exactly one root account.
CREATE UNIQUE INDEX "users_single_root_key" ON "users"("role") WHERE "role" = 'root';

-- Root always holds every permission, so it never has rows here.
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_not_root_check" CHECK ("role" <> 'root');

-- Only permissions of the catalog can be stored.
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_catalog_check" CHECK ("permission" IN (
    'clients:read', 'clients:write',
    'engines:read', 'engines:write',
    'repair_orders:read', 'repair_orders:write',
    'users:manage', 'permissions:manage'
));

-- Default permissions of each role.
INSERT INTO "role_permissions" ("role", "permission") VALUES
    ('admin', 'clients:read'),
    ('admin', 'clients:write'),
    ('admin', 'engines:read'),
    ('admin', 'engines:write'),
    ('admin', 'repair_orders:read'),
    ('admin', 'repair_orders:write'),
    ('admin', 'users:manage'),
    ('admin', 'permissions:manage'),
    ('user', 'clients:read'),
    ('user', 'engines:read'),
    ('user', 'repair_orders:read'),
    ('user', 'repair_orders:write');
