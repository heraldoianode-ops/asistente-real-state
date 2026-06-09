from fastapi import APIRouter, HTTPException, status, Depends
from app.core.supabase import get_supabase
from app.core.auth import get_current_user
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse

router = APIRouter(tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    sb = get_supabase()
    try:
        resp = sb.auth.sign_in_with_password({"email": body.email, "password": body.password})
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))
    if not resp.session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(
        access_token=resp.session.access_token,
        expires_in=resp.session.expires_in or 3600,
    )


@router.post("/logout", status_code=204)
async def logout(user: dict = Depends(get_current_user)):
    sb = get_supabase()
    sb.auth.sign_out()


@router.get("/me", response_model=UserResponse)
async def me(user: dict = Depends(get_current_user)):
    return UserResponse(**user)
