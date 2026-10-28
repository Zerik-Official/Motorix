"""Router of version 1 of the API, which groups every resource router."""

# Third-party
from fastapi import APIRouter

# Project imports
from app.api.v1.routers import clients, engines, me, repair_orders

api_router: APIRouter = APIRouter(prefix="/api/v1")
api_router.include_router(me.router)
api_router.include_router(clients.router)
api_router.include_router(engines.router)
api_router.include_router(repair_orders.router)
