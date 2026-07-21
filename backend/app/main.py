from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.config import settings
from app.routers import admin, auth, departments, documents
from app.seed import init_db


def _validate_production_settings() -> None:
    if not settings.is_production:
        return
    if settings.secret_key == "dev-secret-key-change-in-production":
        raise RuntimeError("프로덕션 배포 시 SECRET_KEY 환경 변수를 설정해야 합니다.")
    static_root = Path(settings.static_dir).resolve()
    if not static_root.is_dir():
        raise RuntimeError(f"프론트엔드 빌드 결과를 찾을 수 없습니다: {static_root}")


def _setup_static_routes(app: FastAPI) -> None:
    static_dir = settings.static_dir.strip()
    if not static_dir:
        return

    root = Path(static_dir).resolve()
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
    _validate_production_settings()
    init_db()
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
    return {"status": "ok", "production": settings.is_production}


_setup_static_routes(app)
