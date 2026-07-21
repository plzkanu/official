import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    REGISTRAR = "registrar"
    TEAM_LEADER = "team_leader"
    DEPARTMENT_USER = "department_user"


class Channel(str, enum.Enum):
    FAX = "fax"
    MAIL = "mail"
    POST = "post"


class DocumentStatus(str, enum.Enum):
    PENDING_RECEPTION = "pending_reception"
    RECEIVED = "received"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class Department(Base):
    __tablename__ = "od_departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    emails: Mapped[Optional[str]] = mapped_column(Text, default="[]")

    users: Mapped[list["User"]] = relationship(back_populates="department")
    documents: Mapped[list["Document"]] = relationship(back_populates="assigned_department")


class User(Base):
    __tablename__ = "od_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, native_enum=False), nullable=False)
    department_id: Mapped[Optional[int]] = mapped_column(ForeignKey("od_departments.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    department: Mapped[Optional["Department"]] = relationship(back_populates="users")
    registered_documents: Mapped[list["Document"]] = relationship(
        back_populates="registered_by_user",
        foreign_keys="Document.registered_by_id",
    )
    received_documents: Mapped[list["Document"]] = relationship(
        back_populates="received_by_user",
        foreign_keys="Document.received_by_id",
    )
    assigned_documents: Mapped[list["Document"]] = relationship(
        back_populates="assigned_user",
        foreign_keys="Document.assigned_user_id",
    )


class Document(Base):
    __tablename__ = "od_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    reception_number: Mapped[Optional[str]] = mapped_column(String(20), unique=True, index=True)
    channel: Mapped[Channel] = mapped_column(Enum(Channel, native_enum=False), nullable=False)
    sender: Mapped[str] = mapped_column(String(200), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    doc_number: Mapped[Optional[str]] = mapped_column(String(100))
    input_reception_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    file_path: Mapped[Optional[str]] = mapped_column(String(500))
    original_filename: Mapped[Optional[str]] = mapped_column(String(255))

    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus, native_enum=False),
        default=DocumentStatus.PENDING_RECEPTION,
    )
    registered_by_id: Mapped[int] = mapped_column(ForeignKey("od_users.id"), nullable=False)
    received_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("od_users.id"))
    received_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    assigned_department_id: Mapped[Optional[int]] = mapped_column(ForeignKey("od_departments.id"))
    assigned_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("od_users.id"))
    deadline: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    memo: Mapped[Optional[str]] = mapped_column(Text)
    receipt_path: Mapped[Optional[str]] = mapped_column(String(500))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    registered_by_user: Mapped["User"] = relationship(
        back_populates="registered_documents",
        foreign_keys=[registered_by_id],
    )
    received_by_user: Mapped[Optional["User"]] = relationship(
        back_populates="received_documents",
        foreign_keys=[received_by_id],
    )
    assigned_department: Mapped[Optional["Department"]] = relationship(back_populates="documents")
    assigned_user: Mapped[Optional["User"]] = relationship(
        back_populates="assigned_documents",
        foreign_keys=[assigned_user_id],
    )


class ReceptionCounter(Base):
    __tablename__ = "od_reception_counters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    year: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    last_number: Mapped[int] = mapped_column(Integer, default=0)
