from datetime import datetime

from pydantic import BaseModel, Field

from app.models import Channel, DocumentStatus, UserRole


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str


class UserBase(BaseModel):
    username: str
    name: str
    role: UserRole
    department_id: int | None = None


class UserCreate(UserBase):
    password: str = Field(min_length=4)


class UserUpdate(BaseModel):
    name: str | None = None
    role: UserRole | None = None
    department_id: int | None = None
    password: str | None = Field(default=None, min_length=4)
    is_active: bool | None = None


class UserResponse(UserBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True


class DepartmentBase(BaseModel):
    name: str
    emails: list[str] = Field(default_factory=list)


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    name: str | None = None
    emails: list[str] | None = None


class DepartmentResponse(DepartmentBase):
    id: int

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_department(cls, dept) -> "DepartmentResponse":
        from app.utils.department_emails import parse_emails_json

        return cls(
            id=dept.id,
            name=dept.name,
            emails=parse_emails_json(dept.emails),
        )


class DocumentCreate(BaseModel):
    channel: Channel
    sender: str
    title: str
    doc_number: str | None = None
    input_reception_date: datetime | None = None
    memo: str | None = None


class DocumentReceive(BaseModel):
    assigned_department_id: int
    assigned_user_id: int | None = None
    deadline: datetime | None = None
    memo: str | None = None


class DocumentSearch(BaseModel):
    keyword: str | None = None
    status: DocumentStatus | None = None
    channel: Channel | None = None
    department_id: int | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    deadline_soon: bool = False


class UserBrief(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class DepartmentBrief(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class DocumentResponse(BaseModel):
    id: int
    reception_number: str | None
    channel: Channel
    sender: str
    title: str
    doc_number: str | None
    input_reception_date: datetime | None
    original_filename: str | None
    status: DocumentStatus
    registered_by: UserBrief
    received_by: UserBrief | None = None
    received_at: datetime | None
    assigned_department: DepartmentBrief | None = None
    assigned_user: UserBrief | None = None
    deadline: datetime | None
    memo: str | None
    has_receipt: bool = False
    attachment_available: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    total: int
    pending_reception: int
    received: int
    deadline_soon: int
    overdue: int


class DigitalStampResponse(BaseModel):
    configured: bool
    filename: str | None = None
    updated_at: str | None = None
