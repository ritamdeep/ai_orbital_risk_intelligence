"""FastAPI application entry point for ASTRAVIGIL Mission Intelligence (port 8001).

Run locally:
    uvicorn backend.mission_intelligence.app:app --reload --port 8001
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_cors_origins
from .database import get_mission_db
from .mission_routes import MissionApiError, router as mission_router
from .schemas import ErrorDetail, StandardErrorResponse


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Load and Pydantic-validate mission_db.json once at startup."""
    get_mission_db()
    yield


def create_app() -> FastAPI:
    application = FastAPI(
        title="ASTRAVIGIL — Mission Intelligence API",
        description=(
            "Mission database, deterministic explainable criticality scoring (rule_based_v1), "
            "alternative satellite continuity comparisons, and guarded AI briefings."
        ),
        version="2.0.0",
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @application.exception_handler(MissionApiError)
    async def mission_api_error_handler(_request: Request, exc: MissionApiError) -> JSONResponse:
        body = StandardErrorResponse(
            error=ErrorDetail(
                code=exc.code,
                message=exc.message,
                status=exc.status_code,
                details=exc.details,
            )
        )
        return JSONResponse(status_code=exc.status_code, content=body.model_dump())

    @application.exception_handler(HTTPException)
    async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
        body = StandardErrorResponse(
            error=ErrorDetail(
                code=f"HTTP_{exc.status_code}",
                message=str(exc.detail),
                status=exc.status_code,
            )
        )
        return JSONResponse(status_code=exc.status_code, content=body.model_dump())

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        body = StandardErrorResponse(
            error=ErrorDetail(
                code="VALIDATION_ERROR",
                message="Request parameters or JSON body failed schema validation.",
                status=422,
                details={"errors": exc.errors()},
            )
        )
        return JSONResponse(status_code=422, content=body.model_dump())

    @application.exception_handler(Exception)
    async def unhandled_exception_handler(_request: Request, _exc: Exception) -> JSONResponse:
        body = StandardErrorResponse(
            error=ErrorDetail(
                code="INTERNAL_SERVER_ERROR",
                message="An unexpected error occurred in the Mission Intelligence service.",
                status=500,
            )
        )
        return JSONResponse(status_code=500, content=body.model_dump())

    application.include_router(mission_router)
    return application


app = create_app()
