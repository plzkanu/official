from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.auth import get_current_user, require_roles
from app.models import User, UserRole
from app.schemas import DigitalStampResponse
from app.services import stamp as stamp_service

router = APIRouter(prefix="/api/admin", tags=["관리자"])

stamp_router = APIRouter(prefix="/digital-stamp")


@stamp_router.get("", response_model=DigitalStampResponse)
async def get_digital_stamp_info(_: User = Depends(require_roles(UserRole.ADMIN))):
    configured = stamp_service.stamp_exists()
    return DigitalStampResponse(
        configured=configured,
        filename=stamp_service.get_stamp_filename() if configured else None,
        updated_at=stamp_service.read_stamp_updated_at() if configured else None,
    )


@stamp_router.get("/image")
async def get_digital_stamp_image(_: User = Depends(get_current_user)):
    if not stamp_service.stamp_exists():
        raise HTTPException(status_code=404, detail="등록된 디지털 접수도장이 없습니다.")
    return FileResponse(
        stamp_service.get_stamp_path(),
        media_type="image/png",
        filename=stamp_service.get_stamp_filename(),
    )


@stamp_router.post("", response_model=DigitalStampResponse)
async def upload_digital_stamp(
    file: UploadFile = File(...),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="파일을 선택해 주세요.")

    try:
        stamp_service.validate_stamp_extension(file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="빈 파일은 업로드할 수 없습니다.")
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="파일 크기는 5MB 이하여야 합니다.")

    try:
        stamp_service.save_stamp_image(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail="이미지 파일을 읽을 수 없습니다.") from e

    updated_at = stamp_service.write_stamp_updated_at()
    return DigitalStampResponse(
        configured=True,
        filename=stamp_service.get_stamp_filename(),
        updated_at=updated_at,
    )


@stamp_router.delete("")
async def delete_digital_stamp(_: User = Depends(require_roles(UserRole.ADMIN))):
    if not stamp_service.stamp_exists():
        raise HTTPException(status_code=404, detail="등록된 디지털 접수도장이 없습니다.")
    stamp_service.remove_stamp()
    return {"message": "디지털 접수도장이 삭제되었습니다. 기본 도장이 사용됩니다."}


router.include_router(stamp_router)

from app.routers import users as users_router  # noqa: E402

router.include_router(users_router.router)
