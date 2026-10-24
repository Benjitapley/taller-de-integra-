"""
Módulo de seguridad del auth_service.
- Hashing de contraseñas con Argon2 (OWASP)
- Tokens JWT para autenticación stateless
- Cifrado Fernet (AES-128-CBC) para datos sensibles en BD
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from cryptography.fernet import Fernet
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv

load_dotenv()

# ==========================================
# CONFIGURACIÓN
# ==========================================
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "clave_por_defecto_cambiar_en_produccion")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRATION_MINUTES = int(os.getenv("JWT_EXPIRATION_MINUTES", "60"))

ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")

# ==========================================
# 1. HASHING DE CONTRASEÑAS (ARGON2)
# ==========================================
ph = PasswordHasher(
    time_cost=3,        # Iteraciones
    memory_cost=65536,  # 64 MB de memoria
    parallelism=4,      # Hilos paralelos
    hash_len=32,        # Longitud del hash
    salt_len=16,        # Longitud del salt
)


def hash_password(password: str) -> str:
    """Genera un hash Argon2id de la contraseña."""
    return ph.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """Verifica una contraseña contra su hash Argon2id.
    Retorna True si coincide, False si no.
    """
    try:
        return ph.verify(hashed, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


# ==========================================
# 2. TOKENS JWT
# ==========================================
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Crea un token JWT con los datos proporcionados.
    
    Args:
        data: Diccionario con claims (debe incluir 'sub' con el id del usuario).
        expires_delta: Duración personalizada del token.
    
    Returns:
        Token JWT codificado como string.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=JWT_EXPIRATION_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decodifica y valida un token JWT.
    
    Raises:
        HTTPException 401 si el token es inválido o expirado.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> int:
    """Dependency de FastAPI que extrae el id del usuario desde el token JWT.
    
    Uso en endpoints:
        @app.get("/ruta")
        def mi_endpoint(id_usuario: int = Depends(get_current_user)):
            ...
    
    Returns:
        id del usuario (int).
    
    Raises:
        HTTPException 401 si no hay token o es inválido.
    """
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se proporcionó token de autenticación.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token no contiene información del usuario.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return int(user_id)


# ==========================================
# 3. CIFRADO DE DATOS SENSIBLES (FERNET)
# ==========================================
_fernet = None


def _get_fernet() -> Fernet:
    """Inicializa Fernet de forma lazy con la clave del .env."""
    global _fernet
    if _fernet is None:
        if not ENCRYPTION_KEY:
            raise RuntimeError(
                "ENCRYPTION_KEY no está configurada en el archivo .env. "
                "Genera una con: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        _fernet = Fernet(ENCRYPTION_KEY.encode())
    return _fernet


def encrypt_data(plain_text: str) -> str:
    """Cifra un texto plano y retorna el texto cifrado en base64.
    
    Útil para almacenar datos sensibles como teléfonos, RUT, etc.
    """
    if not plain_text:
        return plain_text
    return _get_fernet().encrypt(plain_text.encode()).decode()


def decrypt_data(cipher_text: str) -> str:
    """Descifra un texto cifrado con Fernet y retorna el texto original."""
    if not cipher_text:
        return cipher_text
    return _get_fernet().decrypt(cipher_text.encode()).decode()


# ==========================================
# 4. UTILIDAD: GENERAR CLAVES
# ==========================================
def generate_jwt_secret() -> str:
    """Genera una clave segura para JWT_SECRET_KEY."""
    import secrets
    return secrets.token_urlsafe(64)


def generate_encryption_key() -> str:
    """Genera una clave Fernet para ENCRYPTION_KEY."""
    return Fernet.generate_key().decode()
