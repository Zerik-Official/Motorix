import { createBrowserRouter } from "react-router";

import { NotFoundPage } from "@features/shell/NotFoundPage";

/**
 * Routes of the web app: the public landing and login, and the app under `/app`, reserved to
 * signed in accounts. Every page is loaded on demand, so the landing never downloads the code
 * of the app.
 */
export const router = createBrowserRouter([
  {
    path: "/",
    lazy: async () => ({ Component: (await import("@features/landing/LandingPage")).LandingPage }),
  },
  {
    path: "/login",
    lazy: async () => ({ Component: (await import("@features/auth/LoginPage")).LoginPage }),
  },
  {
    path: "/app",
    lazy: async () => ({ Component: (await import("@features/shell/ProtectedAppLayout")).ProtectedAppLayout }),
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import("@features/dashboard/DashboardPage")).DashboardPage }),
      },
      {
        path: "ordenes",
        lazy: async () => ({ Component: (await import("@features/repair-orders/RepairOrdersPage")).RepairOrdersPage }),
      },
      {
        path: "ordenes/:orderId",
        lazy: async () => ({
          Component: (await import("@features/repair-orders/RepairOrderDetailPage")).RepairOrderDetailPage,
        }),
      },
      {
        path: "clientes",
        lazy: async () => ({ Component: (await import("@features/clients/ClientsPage")).ClientsPage }),
      },
      {
        path: "clientes/:clientId",
        lazy: async () => ({ Component: (await import("@features/clients/ClientDetailPage")).ClientDetailPage }),
      },
      {
        path: "motores",
        lazy: async () => ({ Component: (await import("@features/engines/EnginesPage")).EnginesPage }),
      },
      {
        path: "motores/:engineId",
        lazy: async () => ({ Component: (await import("@features/engines/EngineDetailPage")).EngineDetailPage }),
      },
    ],
  },
  { path: "*", Component: NotFoundPage },
]);
