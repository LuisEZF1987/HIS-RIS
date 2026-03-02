from __future__ import annotations

from fastapi import APIRouter

from app.dependencies import CurrentUser, DBSession
from app.schemas.auth import LoginRequest, PasswordChangeRequest, RefreshRequest, TokenResponse
from app.schemas.user import UserMeResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse, summary="Login")
async def login(data: LoginRequest, db: DBSession):
    svc = AuthService(db)
    return await svc.login(data)


@router.post("/refresh", response_model=TokenResponse, summary="Refresh token")
async def refresh_token(data: RefreshRequest, db: DBSession):
    svc = AuthService(db)
    return await svc.refresh(data.refresh_token)


@router.get("/me", response_model=UserMeResponse, summary="Get current user")
async def get_me(current_user: CurrentUser):
    return current_user


@router.put("/change-password", summary="Change password")
async def change_password(data: PasswordChangeRequest, db: DBSession, current_user: CurrentUser):
    svc = AuthService(db)
    await svc.change_password(current_user, data.current_password, data.new_password)
    return {"message": "Contraseña actualizada exitosamente"}


@router.post("/logout", summary="Logout (client-side token invalidation)")
async def logout(current_user: CurrentUser):
    # JWT is stateless; client should discard tokens
    return {"message": "Logged out successfully"}
