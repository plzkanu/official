import json
import re
from typing import Optional

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def parse_emails_json(raw: Optional[str]) -> list[str]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return [str(e).strip() for e in data if str(e).strip()]
    except json.JSONDecodeError:
        pass
    # legacy: single email string stored directly
    stripped = raw.strip()
    return [stripped] if stripped else []


def serialize_emails(emails: list[str]) -> str:
    cleaned = []
    seen = set()
    for email in emails:
        value = email.strip()
        if value and value.lower() not in seen:
            seen.add(value.lower())
            cleaned.append(value)
    return json.dumps(cleaned, ensure_ascii=False)


def validate_emails(emails: list[str]) -> list[str]:
    cleaned = []
    seen = set()
    for email in emails:
        value = email.strip()
        if not value:
            continue
        if not EMAIL_PATTERN.match(value):
            raise ValueError(f"올바르지 않은 메일 주소입니다: {value}")
        key = value.lower()
        if key not in seen:
            seen.add(key)
            cleaned.append(value)
    return cleaned
