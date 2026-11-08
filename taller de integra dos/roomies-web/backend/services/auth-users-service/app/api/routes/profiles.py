"""Provisional D05 profile routes registered by app/main.py."""

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_current_identity, get_profile_repository
from app.application.profile_repository import ProfileRepository
from app.application.profiles import (
    ProfileNotFound,
    ProfileOwnershipViolation,
    ProfileRepositoryUnavailable,
    get_my_profile,
    patch_my_profile,
)
from app.domain.identity import VerifiedIdentity
from app.domain.profile import ProfileRuleViolation
from app.schemas.profile import ProfilePatchRequest, ProfileResponse


router = APIRouter(prefix="/usuarios", tags=["Usuarios"])


def _not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="No existe un perfil para esta identidad.")


@router.get("/me", response_model=ProfileResponse)
def read_my_profile(
    identity: VerifiedIdentity = Depends(get_current_identity),
    repository: ProfileRepository = Depends(get_profile_repository),
) -> ProfileResponse:
    try:
        return get_my_profile(identity, repository)
    except (ProfileNotFound, ProfileOwnershipViolation):
        raise _not_found() from None
    except ProfileRepositoryUnavailable:
        raise HTTPException(
            status_code=503,
            detail="No se pudo consultar el perfil en este momento.",
        ) from None


@router.patch("/me", response_model=ProfileResponse)
def patch_my_profile_route(
    request: ProfilePatchRequest,
    identity: VerifiedIdentity = Depends(get_current_identity),
    repository: ProfileRepository = Depends(get_profile_repository),
) -> ProfileResponse:
    try:
        return patch_my_profile(identity, request.to_patch(), repository)
    except ProfileRuleViolation as error:
        raise HTTPException(422,str(error)) from None
    except (ProfileNotFound, ProfileOwnershipViolation):
        raise _not_found() from None
    except ProfileRepositoryUnavailable:
        raise HTTPException(
            status_code=503,
            detail="No se pudo guardar el perfil en este momento.",
        ) from None
