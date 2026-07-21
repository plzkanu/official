import io
import os
from datetime import datetime

from PIL import Image

from app.config import settings

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}


def get_stamp_dir() -> str:
    return settings.stamp_dir


def get_stamp_path() -> str:
    return os.path.join(settings.stamp_dir, settings.stamp_filename)


def get_stamp_meta_path() -> str:
    return os.path.join(settings.stamp_dir, "digital_stamp.meta")


def get_stamp_filename() -> str:
    return settings.stamp_filename


def ensure_stamp_dir() -> None:
    os.makedirs(settings.stamp_dir, exist_ok=True)


def stamp_exists() -> bool:
    return os.path.isfile(get_stamp_path())


def read_stamp_updated_at() -> str | None:
    meta_path = get_stamp_meta_path()
    if os.path.isfile(meta_path):
        with open(meta_path, encoding="utf-8") as f:
            return f.read().strip() or None
    if stamp_exists():
        mtime = os.path.getmtime(get_stamp_path())
        return datetime.utcfromtimestamp(mtime).isoformat()
    return None


def write_stamp_updated_at() -> str:
    ensure_stamp_dir()
    now = datetime.utcnow().isoformat()
    with open(get_stamp_meta_path(), "w", encoding="utf-8") as f:
        f.write(now)
    return now


def validate_stamp_extension(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError("PNG, JPG, GIF, WEBP 형식만 업로드할 수 있습니다.")
    return ext


def save_stamp_image(content: bytes) -> None:
    ensure_stamp_dir()
    remove_stamp()
    image = Image.open(io.BytesIO(content))
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA")
    image.save(get_stamp_path(), format="PNG")


def remove_stamp() -> None:
    path = get_stamp_path()
    meta_path = get_stamp_meta_path()
    if os.path.isfile(path):
        os.remove(path)
    if os.path.isfile(meta_path):
        os.remove(meta_path)
