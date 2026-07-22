import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user, require_roles
from app.database import get_db
from app.models import Channel, Department, Document, DocumentStatus, User, UserRole
from app.schemas import (
    DashboardStats,
    DepartmentBrief,
    DocumentReceive,
    DocumentResponse,
    UserBrief,
)
from app.services.document_stamping import is_stampable, stamp_document_first_page
from app.services.email_service import send_department_notification
from app.services import file_storage
from app.services.numbering import generate_reception_number
from app.utils.datetime_utils import ensure_utc, utc_now
from app.utils.department_emails import parse_emails_json
from app.utils.http_headers import content_disposition

router = APIRouter(prefix="/api/documents", tags=["공문접수"])


def _parse_input_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return datetime.strptime(value, "%Y-%m-%d")


def _load_document(db: Session, doc_id: int) -> Document | None:
    return (
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


def _can_edit_document(doc: Document, user: User) -> bool:
    if doc.status != DocumentStatus.PENDING_RECEPTION:
        return False
    return doc.registered_by_id == user.id or user.role == UserRole.ADMIN


def _resolve_attachment_key(doc: Document) -> str | None:
    if doc.file_path and not file_storage.is_storage_key(doc.file_path):
        return None

    if doc.file_path and file_storage.is_storage_key(doc.file_path):
        try:
            if file_storage.exists(doc.file_path):
                return doc.file_path
        except file_storage.FileStorageError:
            pass

    try:
        keys = file_storage.list_document_keys(doc.id)
    except file_storage.FileStorageError:
        return None

    if not keys:
        return None

    if doc.status != DocumentStatus.PENDING_RECEPTION:
        stamped = [key for key in keys if "/stamped_" in key]
        if stamped:
            return sorted(stamped)[-1]

    originals = [key for key in keys if "/stamped_" not in key]
    if originals:
        return sorted(originals)[-1]

    return None


def _attachment_available(doc: Document) -> bool:
    return _resolve_attachment_key(doc) is not None


def _has_receipt(doc: Document) -> bool:
    if not doc.reception_number or doc.status == DocumentStatus.PENDING_RECEPTION:
        return False
    key = _resolve_attachment_key(doc)
    return bool(key and "/stamped_" in key)


def _attachment_response(doc: Document, *, inline: bool = True) -> Response:
    storage_key = _resolve_attachment_key(doc)
    if not storage_key:
        detail = (
            "Storage에 첨부파일이 없습니다. 문서를 삭제 후 다시 등록해 주세요."
            if doc.status == DocumentStatus.PENDING_RECEPTION
            else "날인본 파일을 찾을 수 없습니다."
        )
        raise HTTPException(status_code=404, detail=detail)
    try:
        content = file_storage.download(storage_key)
    except file_storage.FileNotFoundStorageError as exc:
        raise HTTPException(status_code=404, detail="첨부파일을 찾을 수 없습니다.") from exc
    except file_storage.FileStorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    filename = doc.original_filename or Path(storage_key).name or "attachment"
    disposition = "inline" if inline else "attachment"
    media_type = file_storage.guess_content_type(storage_key)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": content_disposition(disposition, filename)},
    )


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
        has_receipt=_has_receipt(doc),
        attachment_available=_attachment_available(doc),
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
    original_filename = None
    file_content = None

    if file and file.filename:
        original_filename = file.filename
        file_content = await file.read()
        if not file_content:
            raise HTTPException(status_code=400, detail="빈 파일은 업로드할 수 없습니다.")

    parsed_date = _parse_input_date(input_reception_date)

    doc = Document(
        channel=channel,
        sender=sender,
        title=title,
        doc_number=doc_number,
        input_reception_date=parsed_date,
        file_path=None,
        original_filename=original_filename,
        memo=memo,
        status=DocumentStatus.PENDING_RECEPTION,
        registered_by_id=current_user.id,
    )
    db.add(doc)
    db.flush()

    if file_content and original_filename:
        ext = Path(original_filename).suffix
        storage_key = file_storage.build_document_key(doc.id, f"{uuid.uuid4().hex}{ext}")
        try:
            file_storage.upload_and_verify(storage_key, file_content)
        except file_storage.FileStorageError as exc:
            db.rollback()
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        doc.file_path = storage_key

    db.commit()
    db.refresh(doc)
    doc = _load_document(db, doc.id)
    return _to_response(doc)


@router.patch("/{doc_id}", response_model=DocumentResponse)
async def update_document(
    doc_id: int,
    channel: Channel = Form(...),
    sender: str = Form(...),
    title: str = Form(...),
    doc_number: str | None = Form(None),
    input_reception_date: str | None = Form(None),
    memo: str | None = Form(None),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")
    if not _can_edit_document(doc, current_user):
        if doc.status != DocumentStatus.PENDING_RECEPTION:
            raise HTTPException(status_code=400, detail="수취 확인 전 공문만 수정할 수 있습니다.")
        raise HTTPException(status_code=403, detail="본인이 등록한 공문만 수정할 수 있습니다.")

    doc.channel = channel
    doc.sender = sender.strip()
    doc.title = title.strip()
    doc.doc_number = doc_number.strip() if doc_number and doc_number.strip() else None
    doc.input_reception_date = _parse_input_date(input_reception_date)
    doc.memo = memo.strip() if memo and memo.strip() else None

    new_storage_key: str | None = None
    if file and file.filename:
        file_content = await file.read()
        if not file_content:
            raise HTTPException(status_code=400, detail="빈 파일은 업로드할 수 없습니다.")
        ext = Path(file.filename).suffix
        new_storage_key = file_storage.build_document_key(doc.id, f"{uuid.uuid4().hex}{ext}")
        try:
            file_storage.upload_and_verify(new_storage_key, file_content)
        except file_storage.FileStorageError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        doc.file_path = new_storage_key
        doc.original_filename = file.filename

    db.commit()
    db.refresh(doc)

    if new_storage_key:
        try:
            for key in file_storage.list_document_keys(doc.id):
                if key != new_storage_key:
                    file_storage.delete(key)
        except file_storage.FileStorageError:
            pass

    doc = _load_document(db, doc.id)
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

    storage_key = _resolve_attachment_key(doc)
    if doc.original_filename and not storage_key:
        raise HTTPException(
            status_code=400,
            detail="Storage에 첨부파일이 없어 접수할 수 없습니다. 관리자가 문서를 삭제한 뒤 다시 등록해 주세요.",
        )

    received_at = utc_now()
    reception_number = generate_reception_number(db, received_at.year)

    doc.reception_number = reception_number
    doc.received_at = received_at
    doc.received_by_id = current_user.id
    doc.assigned_department_id = data.assigned_department_id
    doc.assigned_user_id = data.assigned_user_id
    doc.deadline = ensure_utc(data.deadline)
    if data.memo:
        doc.memo = data.memo
    doc.status = DocumentStatus.RECEIVED

    storage_keys_to_delete: list[str] = []

    if storage_key:
        try:
            with file_storage.temp_local_file(storage_key) as local_path:
                if is_stampable(local_path):
                    old_key = storage_key
                    stamped_local = stamp_document_first_page(
                        local_path,
                        reception_number=reception_number,
                        received_at=received_at.replace(tzinfo=None),
                    )
                    if stamped_local:
                        safe_no = reception_number.replace("-", "_")
                        stamped_ext = Path(stamped_local).suffix
                        new_key = file_storage.build_document_key(
                            doc.id,
                            f"stamped_{safe_no}{stamped_ext}",
                        )
                        file_storage.upload_local_file(new_key, stamped_local)
                        doc.file_path = new_key
                        if new_key != old_key:
                            storage_keys_to_delete.append(old_key)
                        if stamped_local != local_path and os.path.exists(stamped_local):
                            os.remove(stamped_local)
        except file_storage.FileNotFoundStorageError as exc:
            raise HTTPException(
                status_code=400,
                detail="Storage에 첨부파일이 없어 접수할 수 없습니다. 관리자가 문서를 삭제한 뒤 다시 등록해 주세요.",
            ) from exc
        except file_storage.FileStorageError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"공문 날인 처리 중 오류가 발생했습니다: {exc}",
            ) from exc

    doc.receipt_path = None
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"접수 정보 저장 중 오류가 발생했습니다: {exc}",
        ) from exc

    for old_key in storage_keys_to_delete:
        file_storage.delete(old_key)

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
        now = utc_now()
        threshold = now + timedelta(days=3)
        query = query.filter(
            Document.deadline.isnot(None),
            Document.deadline <= threshold,
            Document.deadline >= now,
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
    now = utc_now()
    threshold = now + timedelta(days=3)

    return DashboardStats(
        total=len(docs),
        pending_reception=sum(1 for d in docs if d.status == DocumentStatus.PENDING_RECEPTION),
        received=sum(1 for d in docs if d.status == DocumentStatus.RECEIVED),
        deadline_soon=sum(
            1
            for d in docs
            if d.deadline
            and ensure_utc(d.deadline) <= threshold
            and ensure_utc(d.deadline) >= now
            and d.status == DocumentStatus.RECEIVED
        ),
        overdue=sum(
            1
            for d in docs
            if d.deadline
            and ensure_utc(d.deadline) < now
            and d.status == DocumentStatus.RECEIVED
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


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")

    file_path = doc.file_path
    db.delete(doc)
    db.commit()

    try:
        file_storage.delete_all_for_document(doc_id, file_path)
    except file_storage.FileStorageError:
        pass

    return {"message": "공문이 삭제되었습니다."}


@router.get("/{doc_id}/receipt")
async def download_receipt(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """하위 호환: 날인된 첨부 공문으로 리다이렉트"""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="날인된 공문을 찾을 수 없습니다.")
    if not doc.reception_number:
        raise HTTPException(status_code=404, detail="아직 접수되지 않은 공문입니다.")
    return _attachment_response(doc)


@router.get("/{doc_id}/attachment")
async def download_attachment(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="첨부파일을 찾을 수 없습니다.")
    return _attachment_response(doc)
