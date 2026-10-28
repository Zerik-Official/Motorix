/**
 * @file Interactive API reference (`/docs`) and the raw OpenAPI document (`/openapi.json`).
 */

import { Router, type Request, type Response } from "express";
import swaggerUi from "swagger-ui-express";

import { buildOpenApiDocument, type OpenApiDocument } from "../docs/openapi";

/**
 * Builds the router of the API reference; the document is generated once.
 *
 * @returns The router.
 */
export function docsRouter(): Router {
  const document: OpenApiDocument = buildOpenApiDocument();
  const router: Router = Router();
  router.get("/openapi.json", (_request: Request, response: Response): void => {
    response.json(document);
  });
  router.use("/docs", swaggerUi.serve, swaggerUi.setup(document, { customSiteTitle: "Motorix auth API" }));
  return router;
}
