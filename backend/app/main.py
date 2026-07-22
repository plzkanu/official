from contextlib import asynccontextmanager
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.config import settings
from app.routers import admin, auth, departments, documents
from app.seed import init_db

logger = logging.getLogger("uvicorn.error")
_BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _static_root() -> Path:
    raw = settings.static_dir.strip()
    if not raw:
        return Path()
    path = Path(raw)
    if path.is_absolute():
        return path
    return (_BACKEND_ROOT / path).resolve()


def _validate_production_settings() -> None:
    if not settings.is_production:
        return

    problems: list[str] = []
    if settings.secret_key == "dev-secret-key-change-in-production":
        problems.append("SECRET_KEY(또는 Replit SESSION_SECRET) 미설정")
    if not settings.database_url.strip():
        problems.append("DATABASE_URL 미설정")
    if not settings.supabase_service_role_key.strip():
        problems.append("SUPABASE_SERVICE_ROLE_KEY 미설정")
    else:
        try:
            from app.services import file_storage

            file_storage.verify_connectivity()
        except Exception as exc:
            problems.append(f"Supabase Storage 연결 실패: {exc}")

    static_root = _static_root()
    if not static_root.is_dir():
        problems.append(f"frontend/dist 없음 ({static_root}) — npm run build 필요")

    if problems:
        raise RuntimeError("프로덕션 배포 설정 오류: " + " · ".join(problems))


def _setup_static_routes(app: FastAPI) -> None:
    root = _static_root()
    if not root.is_dir():
        return

    index_file = root / "index.html"

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404, detail="Not Found")

        if full_path:
            candidate = root / full_path
            if candidate.is_file():
                return FileResponse(candidate)

        if index_file.is_file():
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Not Found")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        _validate_production_settings()
        init_db()
    except Exception:
        logger.exception("Application startup failed")
        raise
    yield


app = FastAPI(
    title="공문접수 관리 시스템",
    description="공문 접수, 대장 관리, 공문 날인, 알림 기능",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(departments.router)
app.include_router(documents.router)
app.include_router(admin.router)


@app.get("/api/health")
async def health():
    from sqlalchemy import text

    from app.database import engine

    db_ok = False
    db_error: str | None = None
    storage_ok = False
    storage_error: str | None = None
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            db_ok = True
    except Exception as exc:
        db_error = str(exc).split("\n")[0][:200]
    if settings.supabase_service_role_key.strip():
        try:
            from app.services import file_storage

            file_storage.verify_connectivity()
            storage_ok = True
        except Exception as exc:
            storage_error = str(exc).split("\n")[0][:200]
    status_value = "ok" if db_ok and storage_ok else "degraded"
    return {
        "status": status_value,
        "production": settings.is_production,
        "database": "connected" if db_ok else "error",
        "database_error": db_error,
        "storage": "connected" if storage_ok else ("skipped" if not settings.supabase_service_role_key.strip() else "error"),
        "storage_error": storage_error,
    }


_setup_static_routes(app)
