"""ASTRAVIGIL Backend Application Entrypoint.

AI-Powered Orbital Risk Intelligence & Satellite-Service Continuity Platform.
Module: Orbital Risk Engine (Member 2 - feature/orbital-risk)
"""

from datetime import datetime, timezone
from fastapi import FastAPI, Request, status, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.orbital_engine.router import router as orbital_router

app = FastAPI(
    title="ASTRAVIGIL Orbital Risk API",
    description=(
        "Orbital Risk Intelligence & Satellite-Service Continuity Platform.\n\n"
        "Provides deterministic SGP4 propagation, catalogued space debris tracking, "
        "and preliminary close-approach conjunction screening for space sustainability."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable configurable CORS (via CORS_ORIGINS env variable)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Standard Error Shape Exception Handlers
# ============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Formats HTTP exceptions into the standard contract error shape."""
    code = (
        "NOT_FOUND" if exc.status_code == status.HTTP_404_NOT_FOUND
        else "BAD_REQUEST" if exc.status_code == status.HTTP_400_BAD_REQUEST
        else "INTERNAL_SERVER_ERROR"
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": code,
                "message": exc.detail,
                "details": None,
            },
            "detail": exc.detail,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Formats validation exceptions into the standard contract error shape (HTTP 422)."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid request parameter",
                "details": exc.errors(),
            },
            "detail": exc.errors(),
        },
    )


# Mount Orbital Router
app.include_router(orbital_router)


@app.get("/", tags=["System"])
async def root():
    """System platform banner and module metadata."""
    return {
        "platform": "ASTRAVIGIL",
        "tagline": "Beyond Collision Detection. Protecting What Satellites Make Possible.",
        "active_module": "Orbital Risk & Debris Engine",
        "active_branch": "feature/orbital-risk",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "documentation": "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
