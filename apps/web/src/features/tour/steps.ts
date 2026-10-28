import { ROLE_LABELS } from "@shared/session/roles";
import type { Permission, Role } from "@shared/session/types";

/**
 * One step of the guided tour: the page it happens on, the element it points at and what it says.
 */
export interface TourStepDefinition {
  /** Unique name of the step. */
  id: string;
  /** Page the step happens on; the tour opens it before showing the step. */
  route: string;
  /** CSS selector of the element the step points at. */
  selector: string;
  /** Short title of the step. */
  title: string;
  /** What the step explains. */
  body: string;
  /** Opens the popover right below the element, for the elements of the top bar. */
  below?: boolean;
}

/**
 * What the tour needs to know about the signed in account and the screen.
 */
export interface TourContext {
  /** First name of the person, to greet them. */
  firstName: string;
  /** Role of the account. */
  role: Role;
  /** Tells whether the account holds a permission. */
  can: (permission: Permission) => boolean;
  /** Names of the sections the account sees in the navigation. */
  sections: string[];
  /** Whether the sections show in the top bar instead of the menu button. */
  wideNavigation: boolean;
  /** An existing order to show the detail of, if there is any. */
  sampleOrderId: string | null;
}

/**
 * Joins phrases as a Spanish list, such as "a, b y c" or "a u o".
 *
 * @param items - Phrases to join.
 * @param conjunction - Word before the last phrase: "y" or "o", which becomes "u" before an "o" sound.
 * @returns The list.
 */
export function joinList(items: string[], conjunction: "y" | "o" = "y"): string {
  if (items.length <= 1) {
    return items[0] ?? "";
  }
  const last: string = items[items.length - 1] as string;
  const word: string = conjunction === "o" && /^h?o/i.test(last) ? "u" : conjunction;
  return `${items.slice(0, -1).join(", ")} ${word} ${last}`;
}

/**
 * What a role can do, from the permissions it holds right now; the permissions of a role can change,
 * so the tour never assumes them from its name.
 *
 * @param can - Tells whether the account holds a permission.
 * @returns The phrases, or a single one when the role can only look at the dashboard.
 */
export function describeAbilities(can: (permission: Permission) => boolean): string[] {
  const abilities: string[] = [];
  if (can("repair_orders:write")) {
    abilities.push("abrir órdenes de reparación y moverlas de etapa");
  } else if (can("repair_orders:read")) {
    abilities.push("consultar las órdenes de reparación");
  }
  if (can("clients:write")) {
    abilities.push("registrar, editar y desactivar clientes");
  } else if (can("clients:read")) {
    abilities.push("consultar los clientes");
  }
  if (can("engines:write")) {
    abilities.push("registrar, editar y desactivar motores");
  } else if (can("engines:read")) {
    abilities.push("consultar los motores");
  }
  if (can("users:manage")) {
    abilities.push("administrar las cuentas de los roles inferiores al tuyo");
  }
  if (can("permissions:manage")) {
    abilities.push("cambiar los permisos de esos roles");
  }
  return abilities.length > 0 ? abilities : ["ver el tablero"];
}

/**
 * Roles below a given one, as the workshop names them.
 *
 * @param role - Role of the account.
 * @returns The names, from the most to the least privileged.
 */
function lowerRoles(role: Role): string[] {
  const below: Record<Role, Role[]> = { root: ["admin", "user"], admin: ["user"], user: [] };
  return below[role].map((item) => ROLE_LABELS[item]);
}

/**
 * Builds the guided tour of the whole app for one account. Each section only appears when the role
 * can open it, each action only when the role can perform it, and the texts say what the role can
 * and cannot do there.
 *
 * @param context - Account, sections and screen the tour is for.
 * @returns The steps in order.
 */
export function buildTourSteps(context: TourContext): TourStepDefinition[] {
  const { can, role } = context;
  const steps: TourStepDefinition[] = [];
  const roleName: string = ROLE_LABELS[role];
  const managedRoles: string[] = lowerRoles(role);
  const managed: string = joinList(managedRoles);

  steps.push({
    id: "welcome",
    route: "/app",
    selector: "[data-tour='brand']",
    below: true,
    title: `Hola, ${context.firstName}`,
    body: `Entraste como ${roleName}. Con este rol puedes ${joinList(describeAbilities(can))}. Lo que tu rol no puede hacer no aparece en pantalla, y las API lo vuelven a comprobar en cada petición.`,
  });
  steps.push({
    id: "navigation",
    route: "/app",
    selector: context.wideNavigation ? "[data-tour='navigation']" : "[data-tour='menu-toggle']",
    below: true,
    title: "Secciones",
    body: context.wideNavigation
      ? `Estas son las secciones de tu rol: ${joinList(context.sections)}.`
      : `Abre este menú para moverte entre las secciones de tu rol: ${joinList(context.sections)}.`,
  });

  if (can("repair_orders:read")) {
    steps.push(
      {
        id: "stage-board",
        route: "/app",
        selector: "[data-tour='stage-board']",
        title: "Tablero de bahías",
        body: "Cada bahía es una de las siete etapas por las que pasa un motor, de Recibido a Entregado, con cuántas órdenes hay en ella. Elige una bahía para ver sus órdenes.",
      },
      {
        id: "recent-orders",
        route: "/app",
        selector: "[data-tour='recent-orders']",
        title: "Últimas órdenes",
        body: "Las órdenes abiertas más recientemente. Su número lleva al detalle.",
      },
      {
        id: "order-filters",
        route: "/app/ordenes",
        selector: "[data-tour='order-filters']",
        title: "Buscar órdenes",
        body: `Busca por número, falla, serie del motor o cliente, y filtra por etapa${can("clients:read") ? ", cliente" : ""}${can("engines:read") ? " o motor" : ""}. Los filtros quedan en la dirección, así que puedes compartir la búsqueda.`,
      },
    );
    if (can("repair_orders:write")) {
      steps.push({
        id: "new-order",
        route: "/app/ordenes",
        selector: "[data-tour='new-order']",
        title: "Abrir una orden",
        body: "Elige el motor que entra al taller y describe la falla. El cliente de la orden es el dueño del motor, así que no hace falta elegirlo.",
      });
    }
    steps.push({
      id: "orders-results",
      route: "/app/ordenes",
      selector: "[data-tour='orders-results']",
      title: "Listado de órdenes",
      body: can("repair_orders:write")
        ? "De la más reciente a la más antigua. Abre una orden por su número para ver su detalle y moverla de etapa."
        : "De la más reciente a la más antigua. Tu rol puede consultarlas, pero no abrir órdenes ni moverlas de etapa.",
    });

    if (context.sampleOrderId) {
      const detail: string = `/app/ordenes/${context.sampleOrderId}`;
      steps.push({
        id: "stage-track",
        route: detail,
        selector: "[data-tour='stage-track']",
        title: "Ciclo de vida de la orden",
        body: "La pista marca en qué etapa va la orden y cuáles ya pasó: Recibido, En diagnóstico, Esperando aprobación, En reparación, En pruebas, Finalizado y Entregado.",
      });
      if (can("repair_orders:write")) {
        steps.push({
          id: "status-change",
          route: detail,
          selector: "[data-tour='status-change']",
          title: "Mover de etapa",
          body: "Elige la etapa siguiente o cualquier otra si hace falta volver atrás, y deja una nota que explique el cambio.",
        });
      }
      steps.push({
        id: "history",
        route: detail,
        selector: "[data-tour='history']",
        title: "Historial",
        body: can("repair_orders:write")
          ? "Cada cambio de etapa queda aquí con la fecha y la nota, desde que la orden se recibió."
          : "Cada cambio de etapa queda aquí con la fecha y la nota. Tu rol puede consultarlo, pero no mover la orden.",
      });
    }
  }

  if (can("clients:read")) {
    steps.push({
      id: "client-filters",
      route: "/app/clientes",
      selector: "[data-tour='client-filters']",
      title: "Clientes",
      body: "Las empresas y personas dueñas de los motores. Busca por nombre o identificación y elige si ver los activos, los inactivos o todos.",
    });
    steps.push(
      can("clients:write")
        ? {
            id: "new-client",
            route: "/app/clientes",
            selector: "[data-tour='new-client']",
            title: "Registrar un cliente",
            body: "El tipo y el número de identificación no se pueden repetir. Desde su ficha lo editas, lo desactivas o lo reactivas.",
          }
        : {
            id: "clients-results",
            route: "/app/clientes",
            selector: "[data-tour='clients-results']",
            title: "Fichas de clientes",
            body: "Abre un cliente para ver sus datos y sus motores. Tu rol puede consultarlos, pero no registrarlos ni editarlos.",
          },
    );
  }

  if (can("engines:read")) {
    steps.push({
      id: "engine-filters",
      route: "/app/motores",
      selector: "[data-tour='engine-filters']",
      title: "Motores",
      body: `Cada motor con su serie y su dueño. Busca por serie, fabricante o modelo${can("clients:read") ? ", o filtra por cliente" : ""}.`,
    });
    steps.push(
      can("engines:write")
        ? {
            id: "new-engine",
            route: "/app/motores",
            selector: "[data-tour='new-engine']",
            title: "Registrar un motor",
            body: "El número de serie no se puede repetir, y todo motor pertenece a un cliente activo. Solo un motor registrado puede recibir órdenes.",
          }
        : {
            id: "engines-results",
            route: "/app/motores",
            selector: "[data-tour='engines-results']",
            title: "Fichas de motores",
            body: "Abre un motor para ver sus datos, su dueño y sus últimas órdenes. Tu rol puede consultarlos, pero no registrarlos ni editarlos.",
          },
    );
  }

  if (can("users:manage")) {
    steps.push(
      {
        id: "users-results",
        route: "/app/usuarios",
        selector: "[data-tour='users-results']",
        title: "Cuentas",
        body: managed
          ? `Como ${roleName} administras las cuentas de rol ${managed}: las editas, las desactivas o las reactivas. Las de tu rol o uno superior solo las ves.`
          : "Tu rol puede ver las cuentas, pero no hay roles inferiores al tuyo que administrar.",
      },
      {
        id: "new-user",
        route: "/app/usuarios",
        selector: "[data-tour='new-user']",
        title: "Crear una cuenta",
        body: `Cada persona entra con su correo y su contraseña. Solo puedes darle un rol inferior al tuyo: ${joinList(managedRoles, "o")}.`,
      },
    );
  }

  if (can("permissions:manage")) {
    steps.push({
      id: "permission-matrix",
      route: "/app/permisos",
      selector: "[data-tour='permission-matrix']",
      title: "Permisos de cada rol",
      body: `Marca o desmarca lo que puede hacer cada rol. Tú cambias los de ${managed || "ningún rol"}, y solo con permisos que tú tienes. El Superadministrador siempre los tiene todos.`,
    });
  }

  steps.push(
    {
      id: "theme",
      route: "/app",
      selector: "[data-tour='theme-toggle']",
      below: true,
      title: "Tema claro u oscuro",
      body: "Cambia el tema cuando la luz del taller lo pida; se recuerda en este navegador.",
    },
    {
      id: "account",
      route: "/app",
      selector: "[data-tour='account-menu']",
      below: true,
      title: "Tu cuenta",
      body: "Muestra tu nombre y tu rol, y desde aquí cierras la sesión.",
    },
    {
      id: "replay",
      route: "/app",
      selector: "[data-tour='tour-button']",
      below: true,
      title: "Repite el recorrido",
      body: "Ábrelo de nuevo cuando quieras. Si cambian los permisos de tu rol, el recorrido cambia con ellos.",
    },
  );

  return steps;
}
