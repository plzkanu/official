import os

from sqlalchemy import inspect, text

from app.auth import get_password_hash
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import Department, User, UserRole
from app.utils.department_emails import serialize_emails
from app.services.stamp import ensure_stamp_dir


def migrate_department_emails(db) -> None:
    inspector = inspect(engine)
    if "departments" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("departments")}
    if "emails" not in columns:
        db.execute(text("ALTER TABLE departments ADD COLUMN emails TEXT DEFAULT '[]'"))
        db.commit()

    if "email" in columns:
        rows = db.execute(text("SELECT id, email, emails FROM departments")).fetchall()
        for row in rows:
            row_id, legacy_email, emails = row
            if legacy_email and (not emails or emails == "[]"):
                db.execute(
                    text("UPDATE departments SET emails = :emails WHERE id = :id"),
                    {"emails": serialize_emails([legacy_email]), "id": row_id},
                )
        db.commit()


def init_db():
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(settings.receipt_dir, exist_ok=True)
    ensure_stamp_dir()

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        migrate_department_emails(db)

        if db.query(User).count() == 0:
            departments = [
                Department(
                    name="경영지원팀",
                    emails=serialize_emails(["management@company.com"]),
                ),
                Department(name="인사팀", emails=serialize_emails(["hr@company.com"])),
                Department(
                    name="재무팀",
                    emails=serialize_emails(["finance@company.com"]),
                ),
                Department(
                    name="영업팀",
                    emails=serialize_emails(["sales@company.com"]),
                ),
            ]
            db.add_all(departments)
            db.flush()

            mgmt = departments[0]
            hr = departments[1]

            users = [
                User(
                    username="admin",
                    password_hash=get_password_hash("admin1234"),
                    name="시스템관리자",
                    role=UserRole.ADMIN,
                ),
                User(
                    username="registrar",
                    password_hash=get_password_hash("reg1234"),
                    name="접수담당",
                    role=UserRole.REGISTRAR,
                    department_id=mgmt.id,
                ),
                User(
                    username="leader",
                    password_hash=get_password_hash("leader1234"),
                    name="경영지원팀장",
                    role=UserRole.TEAM_LEADER,
                    department_id=mgmt.id,
                ),
                User(
                    username="hr_user",
                    password_hash=get_password_hash("hr1234"),
                    name="인사담당",
                    role=UserRole.DEPARTMENT_USER,
                    department_id=hr.id,
                ),
            ]
            db.add_all(users)
            db.commit()
            print("초기 데이터가 생성되었습니다.")
    finally:
        db.close()
