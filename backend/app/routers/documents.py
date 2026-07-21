import os
import uuid
from datetime import datetime, timedelta

import aiofiles
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user, require_roles
from app.config import settings
from app.database import get_db
from app.models import Channel, Department, Document, DocumentStatus, User, UserRole
from app.schemas import (
    DashboardStats,
    DepartmentBrief,
    DocumentReceive,
    DocumentResponse,
    UserBrief,
)
from app.services.email_service import send_department_notification
from app.utils.department_emails import parse_emails_json
from app.services.numbering import generate_reception_number
from app.services.document_stamping import is_stampable, stamp_document_first_page

router = APIRouter(prefix="/api/documents", tags=["공문접수"])


def _to_response(doc: Document) -> DocumentResponse:
    return DocumentResponse(
        id=doc.id,
        reception_number=doc.reception_number,
        channel=doc.channel,
        sender=doc.sender,
        title=doc.title,
        doc_number=doc.doc_number,
        input_reception_date=doc.input_reception_date,
        original_filename=doc.original_filename,
        status=doc.status,
        registered_by=UserBrief(id=doc.registered_by_user.id, name=doc.registered_by_user.name),
        received_by=UserBrief(id=doc.received_by_user.id, name=doc.received_by_user.name)
        if doc.received_by_user
        else None,
        received_at=doc.received_at,
        assigned_department=DepartmentBrief(
            id=doc.assigned_department.id, name=doc.assigned_department.name
        )
        if doc.assigned_department
        else None,
        assigned_user=UserBrief(id=doc.assigned_user.id, name=doc.assigned_user.name)
        if doc.assigned_user
        else None,
        deadline=doc.deadline,
        memo=doc.memo,
        has_receipt=bool(
            doc.reception_number
            and doc.file_path
            and os.path.exists(doc.file_path)
            and doc.status != DocumentStatus.PENDING_RECEPTION
        ),
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def register_document(
    channel: Channel = Form(...),
    sender: str = Form(...),
    title: str = Form(...),
    doc_number: str | None = Form(None),
    input_reception_date: str | None = Form(None),
    memo: str | None = Form(None),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.REGISTRAR, UserRole.ADMIN, UserRole.TEAM_LEADER)),
):
    file_path = None
    original_filename = None

    if file and file.filename:
        os.makedirs(settings.upload_dir, exist_ok=True)
        ext = os.path.splitext(file.filename)[1]
        saved_name = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(settings.upload_dir, saved_name)
        original_filename = file.filename
        content = await file.read()
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)

    parsed_date = None
    if input_reception_date:
        try:
            parsed_date = datetime.fromisoformat(input_reception_date.replace("Z", "+00:00"))
        except ValueError:
            parsed_date = datetime.strptime(input_reception_date, "%Y-%m-%d")

    doc = Document(
        channel=channel,
        sender=sender,
        title=title,
        doc_number=doc_number,
        input_reception_date=parsed_date,
        file_path=file_path,
        original_filename=original_filename,
        memo=memo,
        status=DocumentStatus.PENDING_RECEPTION,
        registered_by_id=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    doc = (
        db.query(Document)
        .options(
            joinedload(Document.registered_by_user),
            joinedload(Document.received_by_user),
            joinedload(Document.assigned_department),
            joinedload(Document.assigned_user),
        )
        .filter(Document.id == doc.id)
        .first()
    )
    return _to_response(doc)


@router.post("/{doc_id}/receive", response_model=DocumentResponse)
async def receive_document(
    doc_id: int,
    data: DocumentReceive,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.TEAM_LEADER, UserRole.ADMIN)),
):
    doc = (
        db.query(Document)
        .options(
            joinedload(Document.registered_by_user),
            joinedload(Document.assigned_department),
        )
        .filter(Document.id == doc_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")
    if doc.status != DocumentStatus.PENDING_RECEPTION:
        raise HTTPException(status_code=400, detail="이미 접수된 문서입니다.")

    department = db.query(Department).filter(Department.id == data.assigned_department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="담당부서를 찾을 수 없습니다.")

    received_at = datetime.utcnow()
    reception_number = generate_reception_number(db, received_at.year)

    doc.reception_number = reception_number
    doc.received_at = received_at
    doc.received_by_id = current_user.id
    doc.assigned_department_id = data.assigned_department_id
    doc.assigned_user_id = data.assigned_user_id
    doc.deadline = data.deadline
    if data.memo:
        doc.memo = data.memo
    doc.status = DocumentStatus.RECEIVED

    if doc.file_path and os.path.exists(doc.file_path):
        if is_stampable(doc.file_path):
            try:
                old_path = doc.file_path
                stamped_path = stamp_document_first_page(
                    old_path,
                    reception_number=reception_number,
                    received_at=received_at,
                )
                if stamped_path:
                    doc.file_path = stamped_path
                    if stamped_path != old_path and os.path.exists(old_path):
                        os.remove(old_path)
            except Exception as exc:
                raise HTTPException(
                    status_code=500,
                    detail=f"공문 날인 처리 중 오류가 발생했습니다: {exc}",
                ) from exc

    doc.receipt_path = None

    db.commit()

    notification_emails = parse_emails_json(department.emails)
    if notification_emails:
        await send_department_notification(
            to_emails=notification_emails,
            department_name=department.name,
            reception_number=reception_number,
            title=doc.title,
            sender=doc.sender,
            received_at=received_at.strftime("%Y-%m-%d %H:%M"),
        )

    doc = (
        db.query(Document)
        .options(
            joinedload(Document.registered_by_user),
            joinedload(Document.received_by_user),
            joinedload(Document.assigned_department),
            joinedload(Document.assigned_user),
        )
        .filter(Document.id == doc.id)
        .first()
    )
    return _to_response(doc)


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    keyword: str | None = None,
    status: DocumentStatus | None = None,
    channel: Channel | None = None,
    department_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    deadline_soon: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Document).options(
        joinedload(Document.registered_by_user),
        joinedload(Document.received_by_user),
        joinedload(Document.assigned_department),
        joinedload(Document.assigned_user),
    )

    if current_user.role == UserRole.DEPARTMENT_USER:
        query = query.filter(Document.assigned_department_id == current_user.department_id)

    if keyword:
        like = f"%{keyword}%"
        query = query.filter(
            or_(
                Document.title.ilike(like),
                Document.sender.ilike(like),
                Document.reception_number.ilike(like),
                Document.doc_number.ilike(like),
            )
        )
    if status:
        query = query.filter(Document.status == status)
    if channel:
        query = query.filter(Document.channel == channel)
    if department_id:
        query = query.filter(Document.assigned_department_id == department_id)
    if date_from:
        query = query.filter(Document.received_at >= date_from)
    if date_to:
        query = query.filter(Document.received_at <= date_to)
    if deadline_soon:
        threshold = datetime.utcnow() + timedelta(days=3)
        query = query.filter(
            Document.deadline.isnot(None),
            Document.deadline <= threshold,
            Document.deadline >= datetime.utcnow(),
            Document.status == DocumentStatus.RECEIVED,
        )

    docs = query.order_by(Document.created_at.desc()).all()
    return [_to_response(d) for d in docs]


@router.get("/stats", response_model=DashboardStats)
async def get_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Document)
    if current_user.role == UserRole.DEPARTMENT_USER:
        query = query.filter(Document.assigned_department_id == current_user.department_id)

    docs = query.all()
    now = datetime.utcnow()
    threshold = now + timedelta(days=3)

    return DashboardStats(
        total=len(docs),
        pending_reception=sum(1 for d in docs if d.status == DocumentStatus.PENDING_RECEPTION),
        received=sum(1 for d in docs if d.status == DocumentStatus.RECEIVED),
        deadline_soon=sum(
            1
            for d in docs
            if d.deadline
            and d.deadline <= threshold
            and d.deadline >= now
            and d.status == DocumentStatus.RECEIVED
        ),
        overdue=sum(
            1
            for d in docs
            if d.deadline and d.deadline < now and d.status == DocumentStatus.RECEIVED
        ),
    )


@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = (
        db.query(Document)
        .options(
            joinedload(Document.registered_by_user),
            joinedload(Document.received_by_user),
            joinedload(Document.assigned_department),
            joinedload(Document.assigned_user),
        )
        .filter(Document.id == doc_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")
    return _to_response(doc)


@router.get("/{doc_id}/receipt")
async def download_receipt(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """하위 호환: 날인된 첨부 공문으로 리다이렉트"""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc or not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="날인된 공문을 찾을 수 없습니다.")
    if not doc.reception_number:
        raise HTTPException(status_code=404, detail="아직 접수되지 않은 공문입니다.")
    return FileResponse(
        doc.file_path,
        filename=doc.original_filename or f"접수_{doc.reception_number}.pdf",
    )


@router.get("/{doc_id}/attachment")
async def download_attachment(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc or not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="첨부파일을 찾을 수 없습니다.")
    return FileResponse(
        doc.file_path,
        filename=doc.original_filename or "attachment",
    )
