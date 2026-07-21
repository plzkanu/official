from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_roles
from app.database import get_db
from app.models import Department, Document, User, UserRole
from app.schemas import DepartmentCreate, DepartmentResponse, DepartmentUpdate, UserResponse
from app.utils.department_emails import serialize_emails, validate_emails

router = APIRouter(prefix="/api", tags=["기본정보"])


def _to_response(dept: Department) -> DepartmentResponse:
    return DepartmentResponse.from_orm_department(dept)


def _get_department_or_404(db: Session, dept_id: int) -> Department:
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="부서를 찾을 수 없습니다.")
    return dept


def _check_duplicate_name(db: Session, name: str, exclude_id: int | None = None) -> None:
    query = db.query(Department).filter(Department.name == name)
    if exclude_id:
        query = query.filter(Department.id != exclude_id)
    if query.first():
        raise HTTPException(status_code=400, detail="이미 존재하는 부서명입니다.")


def _normalize_emails(emails: list[str]) -> list[str]:
    try:
        return validate_emails(emails)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/departments", response_model=list[DepartmentResponse])
async def list_departments(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    departments = db.query(Department).order_by(Department.name).all()
    return [_to_response(d) for d in departments]


@router.post("/departments", response_model=DepartmentResponse)
async def create_department(
    data: DepartmentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="부서명을 입력해 주세요.")
    _check_duplicate_name(db, name)

    emails = _normalize_emails(data.emails)
    dept = Department(name=name, emails=serialize_emails(emails))
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return _to_response(dept)


@router.patch("/departments/{dept_id}", response_model=DepartmentResponse)
async def update_department(
    dept_id: int,
    data: DepartmentUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    dept = _get_department_or_404(db, dept_id)

    if data.name is not None:
        name = data.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="부서명을 입력해 주세요.")
        _check_duplicate_name(db, name, exclude_id=dept_id)
        dept.name = name

    if data.emails is not None:
        emails = _normalize_emails(data.emails)
        dept.emails = serialize_emails(emails)

    db.commit()
    db.refresh(dept)
    return _to_response(dept)


@router.delete("/departments/{dept_id}")
async def delete_department(
    dept_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    dept = _get_department_or_404(db, dept_id)

    user_count = db.query(User).filter(User.department_id == dept_id).count()
    if user_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"소속 사용자가 {user_count}명 있어 삭제할 수 없습니다.",
        )

    doc_count = db.query(Document).filter(Document.assigned_department_id == dept_id).count()
    if doc_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"배정된 공문이 {doc_count}건 있어 삭제할 수 없습니다.",
        )

    db.delete(dept)
    db.commit()
    return {"message": "부서가 삭제되었습니다."}


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    department_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(User).filter(User.is_active == True)
    if department_id:
        query = query.filter(User.department_id == department_id)
    return query.order_by(User.name).all()
