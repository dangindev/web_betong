import traceback

from fastapi import Request
from fastapi.responses import JSONResponse


def api_error_handler(request: Request, exc: ValueError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "unknown")
    return JSONResponse(
        status_code=400,
        content={"error": str(exc), "request_id": request_id, "trace": exc.__class__.__name__},
    )


def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "unknown")
    trace = traceback.format_exception_only(type(exc), exc)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "request_id": request_id,
            "trace": "".join(trace).strip(),
        },
    )
