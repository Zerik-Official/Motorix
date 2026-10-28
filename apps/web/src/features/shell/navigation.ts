import type { IconType } from "react-icons";
import { LuBuilding2, LuClipboardList, LuCog, LuLayoutDashboard } from "react-icons/lu";

import type { Permission } from "@shared/session/types";

/**
 * Entry of the main navigation.
 */
export interface NavItem {
  /** Route of the section. */
  to: string;
  /** Visible name of the section. */
  label: string;
  /** Icon shown next to the name. */
  icon: IconType;
  /** Permission needed to see the entry; entries without it are shown to everyone signed in. */
  permission?: Permission;
  /** Identifier of the entry for the guided tour. */
  tourId: string;
}

/**
 * Sections of the app, in the order they appear in the navigation.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: "/app", label: "Tablero", icon: LuLayoutDashboard, tourId: "nav-dashboard" },
  { to: "/app/ordenes", label: "Órdenes", icon: LuClipboardList, permission: "repair_orders:read", tourId: "nav-orders" },
  { to: "/app/clientes", label: "Clientes", icon: LuBuilding2, permission: "clients:read", tourId: "nav-clients" },
  { to: "/app/motores", label: "Motores", icon: LuCog, permission: "engines:read", tourId: "nav-engines" },
];
