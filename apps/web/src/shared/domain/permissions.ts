import type { Permission } from "@shared/session/types";

/**
 * What each permission lets an account do, as the workshop says it.
 */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "clients:read": "Ver clientes",
  "clients:write": "Registrar, editar y desactivar clientes",
  "engines:read": "Ver motores",
  "engines:write": "Registrar, editar y desactivar motores",
  "repair_orders:read": "Ver órdenes de reparación",
  "repair_orders:write": "Abrir órdenes y cambiarlas de etapa",
  "users:manage": "Administrar usuarios de roles inferiores",
  "permissions:manage": "Cambiar los permisos de roles inferiores",
};
