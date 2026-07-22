import os
import re
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import quote

import httpx

from app.config import settings

STORAGE_PREFIX = "documents/"


class FileStorageError(RuntimeError):
    pass


class FileNotFoundStorageError(FileStorageError):
    pass


def _derive_supabase_url(database_url: str) -> str:
    match = re.search(r"postgres\.([a-z0-9]+):", database_url)
    if match:
        return f"https://{match.group(1)}.supabase.co"
    return ""


def is_storage_key(path: str | None) -> bool:
    return bool(path and path.startswith(STORAGE_PREFIX))


def build_document_key(doc_id: int, filename: str) -> str:
    safe_name = Path(filename.replace("\\", "/")).name
    return f"{STORAGE_PREFIX}{doc_id}/{safe_name}"


def _storage_config() -> tuple[str, str, str]:
    url = settings.effective_supabase_url
    key = settings.supabase_service_role_key.strip()
    bucket = settings.storage_bucket.strip() or "document-attachments"
    if not url or not key:
        raise RuntimeError(
            "첨부·날인본 저장을 위해 SUPABASE_SERVICE_ROLE_KEY가 필요합니다. "
            "Supabase Dashboard → Settings → API → service_role 값을 "
            "backend/.env 또는 Replit Secrets에 설정하세요."
        )
    return url.rstrip("/"), key, bucket


def _object_url(key: str) -> str:
    base_url, _, bucket = _storage_config()
    encoded = quote(key, safe="/")
    return f"{base_url}/storage/v1/object/{bucket}/{encoded}"


def _auth_headers(**extra: str) -> dict[str, str]:
    _, service_key, _ = _storage_config()
    headers = {"Authorization": f"Bearer {service_key}"}
    headers.update(extra)
    return headers


def _httpx_verify() -> bool:
    """회사 VPN/방화벽 TLS 오류 시 SUPABASE_SSL_VERIFY=0 으로 비활성화 (DB와 동일)."""
    return settings.database_ssl_verify


def guess_content_type(key: str) -> str:
    ext = Path(key).suffix.lower()
    mapping = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".tif": "image/tiff",
        ".tiff": "image/tiff",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".hwp": "application/x-hwp",
        ".hwpx": "application/hwp+zip",
    }
    return mapping.get(ext, "application/octet-stream")


def _format_upload_error(status_code: int, body: str) -> str:
    if status_code == 400 and "invalid_mime_type" in body:
        return (
            "Storage 버킷에서 해당 파일 형식을 허용하지 않습니다. "
            "Supabase SQL Editor에서 document-attachments 버킷의 "
            "allowed_mime_types를 NULL로 업데이트하세요."
        )
    return f"Storage upload failed ({status_code}): {body[:200]}"


def upload(key: str, content: bytes, content_type: str | None = None) -> str:
    response = httpx.post(
        _object_url(key),
        headers=_auth_headers(
            **{
                "Content-Type": content_type or guess_content_type(key),
                "x-upsert": "true",
            }
        ),
        content=content,
        timeout=120.0,
        verify=_httpx_verify(),
    )
    if response.status_code not in (200, 201):
        raise FileStorageError(_format_upload_error(response.status_code, response.text))
    return key


def download(key: str) -> bytes:
    response = httpx.get(
        _object_url(key),
        headers=_auth_headers(),
        timeout=120.0,
        verify=_httpx_verify(),
    )
    if response.status_code == 404 or (
        response.status_code == 400 and "not_found" in response.text.lower()
    ):
        raise FileNotFoundStorageError(key)
    if response.status_code >= 400:
        raise FileStorageError(
            f"Storage download failed ({response.status_code}): {response.text[:200]}"
        )
    return response.content


def delete(key: str) -> None:
    if not is_storage_key(key):
        return
    response = httpx.delete(
        _object_url(key),
        headers=_auth_headers(),
        timeout=60.0,
        verify=_httpx_verify(),
    )
    if response.status_code not in (200, 204, 404):
        raise FileStorageError(
            f"Storage delete failed ({response.status_code}): {response.text[:200]}"
        )


def exists(key: str) -> bool:
    if not is_storage_key(key):
        return False
    response = httpx.head(
        _object_url(key),
        headers=_auth_headers(),
        timeout=30.0,
        verify=_httpx_verify(),
    )
    if response.status_code == 200:
        return True
    if response.status_code in (404, 400):
        return False
    # 일부 환경에서 HEAD가 거부되면 Range GET으로 재확인
    ranged = httpx.get(
        _object_url(key),
        headers=_auth_headers(**{"Range": "bytes=0-0"}),
        timeout=30.0,
        verify=_httpx_verify(),
    )
    if ranged.status_code in (200, 206):
        return True
    if ranged.status_code in (404, 400):
        return False
    raise FileStorageError(
        f"Storage exists check failed (HEAD {response.status_code}, "
        f"GET {ranged.status_code}): {ranged.text[:200]}"
    )


def verify_connectivity() -> None:
    """프로덕션 기동 시 Supabase Storage 버킷 접근 가능 여부 확인."""
    base_url, _, bucket = _storage_config()
    list_url = f"{base_url}/storage/v1/object/list/{bucket}"
    response = httpx.post(
        list_url,
        headers=_auth_headers(**{"Content-Type": "application/json"}),
        json={"prefix": STORAGE_PREFIX, "limit": 1},
        timeout=30.0,
        verify=_httpx_verify(),
    )
    if response.status_code >= 400:
        raise FileStorageError(
            f"Storage bucket '{bucket}' 접근 실패 ({response.status_code}): "
            f"{response.text[:200]}"
        )


def upload_and_verify(key: str, content: bytes, content_type: str | None = None) -> str:
    upload(key, content, content_type=content_type)
    if not exists(key):
        try:
            delete(key)
        except FileStorageError:
            pass
        raise FileStorageError(
            "Storage 업로드 후 파일 확인에 실패했습니다. "
            "document-attachments 버킷과 SUPABASE_SERVICE_ROLE_KEY를 확인하세요."
        )
    return key


def list_document_keys(doc_id: int) -> list[str]:
    base_url, service_key, bucket = _storage_config()
    list_url = f"{base_url}/storage/v1/object/list/{bucket}"
    prefix = f"{STORAGE_PREFIX}{doc_id}/"
    response = httpx.post(
        list_url,
        headers=_auth_headers(**{"Content-Type": "application/json"}),
        json={"prefix": prefix, "limit": 100},
        timeout=30.0,
        verify=_httpx_verify(),
    )
    if response.status_code >= 400:
        raise FileStorageError(
            f"Storage list failed ({response.status_code}): {response.text[:200]}"
        )
    return [f"{prefix}{item['name']}" for item in response.json() if item.get("name")]


def upload_local_file(key: str, local_path: str) -> str:
    with open(local_path, "rb") as file:
        return upload(key, file.read())


def delete_all_for_document(doc_id: int, file_path: str | None = None) -> None:
    keys: set[str] = set()
    try:
        keys.update(list_document_keys(doc_id))
    except FileStorageError:
        pass
    if file_path and is_storage_key(file_path):
        keys.add(file_path)
    for key in keys:
        delete(key)


@contextmanager
def temp_local_file(key: str):
    content = download(key)
    suffix = Path(key).suffix or ".bin"
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    temp_path = Path(path)
    temp_path.write_bytes(content)
    try:
        yield str(temp_path)
    finally:
        for _ in range(5):
            try:
                temp_path.unlink(missing_ok=True)
                break
            except PermissionError:
                time.sleep(0.1)
