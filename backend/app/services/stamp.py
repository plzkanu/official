import io
import os
from datetime import datetime

from PIL import Image

from app.config import settings
from app.database import SessionLocal
from app.models import DigitalStamp

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
STAMP_ROW_ID = 1


def get_stamp_dir() -> str:
    return settings.stamp_dir


def get_stamp_path() -> str:
    return os.path.join(settings.stamp_dir, settings.stamp_filename)


def get_stamp_meta_path() -> str:
    return os.path.join(settings.stamp_dir, "digital_stamp.meta")


def get_stamp_filename() -> str:
    db = SessionLocal()
    try:
        row = db.get(DigitalStamp, STAMP_ROW_ID)
        if row:
            return row.filename
    finally:
        db.close()
    return settings.stamp_filename


def ensure_stamp_dir() -> None:
    os.makedirs(settings.stamp_dir, exist_ok=True)


def _png_bytes_from_content(content: bytes) -> bytes:
    image = Image.open(io.BytesIO(content))
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA")
    out = io.BytesIO()
    image.save(out, format="PNG")
    return out.getvalue()


def stamp_exists() -> bool:
    db = SessionLocal()
    try:
        row = db.get(DigitalStamp, STAMP_ROW_ID)
        return row is not None and bool(row.image_data)
    finally:
        db.close()


def get_stamp_bytes() -> bytes | None:
    db = SessionLocal()
    try:
        row = db.get(DigitalStamp, STAMP_ROW_ID)
        return row.image_data if row else None
    finally:
        db.close()


def read_stamp_updated_at() -> str | None:
    db = SessionLocal()
    try:
        row = db.get(DigitalStamp, STAMP_ROW_ID)
        if row:
            return row.updated_at.isoformat()
    finally:
        db.close()

    path = get_stamp_path()
    if os.path.isfile(path):
        mtime = os.path.getmtime(path)
        return datetime.utcfromtimestamp(mtime).isoformat()
    return None


def write_stamp_updated_at() -> str:
    updated_at = read_stamp_updated_at()
    return updated_at or datetime.utcnow().isoformat()


def validate_stamp_extension(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError("PNG, JPG, GIF, WEBP 형식만 업로드할 수 있습니다.")
    return ext


def save_stamp_image(content: bytes, filename: str | None = None) -> str:
    png_bytes = _png_bytes_from_content(content)
    now = datetime.utcnow()
    stored_name = filename or settings.stamp_filename

    db = SessionLocal()
    try:
        row = db.get(DigitalStamp, STAMP_ROW_ID)
        if row:
            row.image_data = png_bytes
            row.filename = stored_name
            row.updated_at = now
        else:
            db.add(
                DigitalStamp(
                    id=STAMP_ROW_ID,
                    image_data=png_bytes,
                    filename=stored_name,
                    updated_at=now,
                )
            )
        db.commit()
    finally:
        db.close()

    _sync_local_cache(png_bytes)
    return now.isoformat()


def remove_stamp() -> None:
    db = SessionLocal()
    try:
        row = db.get(DigitalStamp, STAMP_ROW_ID)
        if row:
            db.delete(row)
            db.commit()
    finally:
        db.close()

    path = get_stamp_path()
    meta_path = get_stamp_meta_path()
    if os.path.isfile(path):
        os.remove(path)
    if os.path.isfile(meta_path):
        os.remove(meta_path)


def migrate_stamp_from_filesystem() -> bool:
    """기존 로컬 파일 도장을 DB로 한 번 이전 (하위 호환)."""
    if stamp_exists():
        return False

    path = get_stamp_path()
    if not os.path.isfile(path):
        return False

    with open(path, "rb") as f:
        save_stamp_image(f.read())
    return True


def _sync_local_cache(png_bytes: bytes) -> None:
    """날인 처리 속도를 위해 로컬 캐시도 유지 (없어도 DB에서 복구 가능)."""
    ensure_stamp_dir()
    with open(get_stamp_path(), "wb") as f:
        f.write(png_bytes)
    with open(get_stamp_meta_path(), "w", encoding="utf-8") as f:
        f.write(datetime.utcnow().isoformat())
