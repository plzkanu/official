from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_password_hash, require_roles
from app.database import get_db
from app.models import Department, User, UserRole
from app.schemas import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["관리자"])


def _get_user_or_404(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    return user


def _validate_department(db: Session, role: UserRole, department_id: int | None) -> None:
    if role == UserRole.DEPARTMENT_USER and not department_id:
        raise HTTPException(status_code=400, detail="담당부서 사용자는 부서를 선택해야 합니다.")
    if department_id:
        dept = db.query(Department).filter(Department.id == department_id).first()
        if not dept:
            raise HTTPException(status_code=404, detail="부서를 찾을 수 없습니다.")


@router.get("", response_model=list[UserResponse])
async def list_all_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    return db.query(User).order_by(User.name).all()


@router.post("", response_model=UserResponse)
async def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    username = data.username.strip()
    name = data.name.strip()
    if not username or not name:
        raise HTTPException(status_code=400, detail="아이디와 이름을 입력해 주세요.")

    existing = db.query(User).filter(User.username == username).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")

    _validate_department(db, data.role, data.department_id)

    user = User(
        username=username,
        password_hash=get_password_hash(data.password),
        name=name,
        role=data.role,
        department_id=data.department_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    user = _get_user_or_404(db, user_id)

    if data.is_active is False and user.id == current_user.id:
        raise HTTPException(status_code=400, detail="자신의 계정은 비활성화할 수 없습니다.")

    new_role = data.role if data.role is not None else user.role
    new_department_id = (
        data.department_id if data.department_id is not None else user.department_id
    )
    if data.role is not None or data.department_id is not None:
        _validate_department(db, new_role, new_department_id)

    if data.name is not None:
        name = data.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="이름을 입력해 주세요.")
        user.name = name

    if data.role is not None:
        user.role = data.role

    if data.department_id is not None:
        user.department_id = data.department_id or None

    if data.password:
        user.password_hash = get_password_hash(data.password)

    if data.is_active is not None:
        user.is_active = data.is_active

    db.commit()
    db.refresh(user)
    return user
