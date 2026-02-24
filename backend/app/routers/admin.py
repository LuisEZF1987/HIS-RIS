from __future__ import annotations

from fastapi import APIRouter

from app.dependencies import CurrentUser, DBSession, require_permission, require_role
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.services.auth_service import AuthService
from sqlalchemy import select

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/users", response_model=UserResponse, status_code=201,
             dependencies=[require_role(UserRole.admin)])
async def create_user(data: UserCreate, db: DBSession, current_user: CurrentUser):
    svc = AuthService(db)
    user = await svc.create_user(
        username=data.username,
        email=data.email,
        password=data.password,
        full_name=data.full_name,
        role=data.role,
    )
    return user


@router.get("/users", response_model=list[UserResponse],
            dependencies=[require_role(UserRole.admin)])
async def list_users(db: DBSession):
    result = await db.execute(select(User).order_by(User.username))
    return result.scalars().all()


@router.get("/users/{user_id}", response_model=UserResponse,
            dependencies=[require_role(UserRole.admin)])
async def get_user(user_id: int, db: DBSession):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(f"User {user_id} not found")
    return user


@router.put("/users/{user_id}", response_model=UserResponse,
            dependencies=[require_role(UserRole.admin)])
async def update_user(user_id: int, data: UserUpdate, db: DBSession, current_user: CurrentUser):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(f"User {user_id} not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await db.flush()
    return user


@router.delete("/users/{user_id}", status_code=204,
               dependencies=[require_role(UserRole.admin)])
async def deactivate_user(user_id: int, db: DBSession, current_user: CurrentUser):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(f"User {user_id} not found")
    if user.id == current_user.id:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("Cannot deactivate your own account")
    user.is_active = False
    await db.flush()
