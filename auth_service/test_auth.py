"""
SCRUM-81 — Tests de autenticación, permisos y verificación de identidad.
Ejecutar con: pytest auth_service/test_auth.py -v

Requiere instalar (una sola vez):
    pip install pytest httpx

Estos tests usan el TestClient de FastAPI (no requieren conexión a BD real).
Se mockea la función `conectar()` para aislar la lógica de negocio.
"""

import os
import sys
from datetime import date, datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

# Asegurar que el directorio raíz del proyecto esté en el path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configurar variables de entorno ANTES de importar los módulos
os.environ.setdefault("JWT_SECRET_KEY", "test_secret_key_for_testing_only")
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("JWT_EXPIRATION_MINUTES", "60")
os.environ.setdefault("ENCRYPTION_KEY", "dGVzdF9lbmNyeXB0aW9uX2tleV8xMjM0NTY3ODk=")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")


# ==========================================
# Tests del módulo security.py
# ==========================================
class TestSecurity:
    """Tests para las funciones de seguridad (hash, JWT, cifrado)."""

    def test_hash_password_genera_hash(self):
        """El hash generado no es igual al password original."""
        from auth_service.security import hash_password
        hashed = hash_password("MiPassword123")
        assert hashed != "MiPassword123"
        assert hashed.startswith("$argon2")

    def test_verify_password_correcto(self):
        """verify_password retorna True con la contraseña correcta."""
        from auth_service.security import hash_password, verify_password
        hashed = hash_password("Secreto456")
        assert verify_password("Secreto456", hashed) is True

    def test_verify_password_incorrecto(self):
        """verify_password retorna False con contraseña incorrecta."""
        from auth_service.security import hash_password, verify_password
        hashed = hash_password("Secreto456")
        assert verify_password("OtraPassword", hashed) is False

    def test_create_access_token_genera_string(self):
        """create_access_token retorna un string no vacío."""
        from auth_service.security import create_access_token
        token = create_access_token(data={"sub": "123", "nombre": "Test"})
        assert isinstance(token, str)
        assert len(token) > 0

    def test_decode_access_token_valido(self):
        """Un token recién creado se decodifica correctamente."""
        from auth_service.security import create_access_token, decode_access_token
        token = create_access_token(data={"sub": "42", "nombre": "Juan"})
        payload = decode_access_token(token)
        assert payload["sub"] == "42"
        assert payload["nombre"] == "Juan"
        assert "exp" in payload

    def test_decode_access_token_invalido(self):
        """Un token inválido lanza HTTPException 401."""
        from auth_service.security import decode_access_token
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            decode_access_token("token.invalido.aqui")
        assert exc_info.value.status_code == 401

    def test_decode_access_token_expirado(self):
        """Un token expirado lanza HTTPException 401."""
        from auth_service.security import create_access_token, decode_access_token
        from fastapi import HTTPException
        token = create_access_token(
            data={"sub": "1"},
            expires_delta=timedelta(seconds=-10)  # Ya expirado
        )
        with pytest.raises(HTTPException) as exc_info:
            decode_access_token(token)
        assert exc_info.value.status_code == 401

    def test_get_current_user_sin_token(self):
        """get_current_user sin token lanza HTTPException 401."""
        from auth_service.security import get_current_user
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(token=None)
        assert exc_info.value.status_code == 401

    def test_get_current_user_con_token_valido(self):
        """get_current_user con token válido retorna el id del usuario."""
        from auth_service.security import create_access_token, get_current_user
        token = create_access_token(data={"sub": "99", "nombre": "Test"})
        user_id = get_current_user(token=token)
        assert user_id == 99


# ==========================================
# Tests del módulo email_service.py
# ==========================================
class TestEmailService:
    """Tests para las funciones del servicio de email."""

    def test_generar_codigo_6_digitos(self):
        """generar_codigo retorna un string numérico de 6 dígitos."""
        from auth_service.email_service import generar_codigo
        codigo = generar_codigo()
        assert len(codigo) == 6
        assert codigo.isdigit()

    def test_generar_codigo_longitud_personalizada(self):
        """generar_codigo con longitud personalizada."""
        from auth_service.email_service import generar_codigo
        codigo = generar_codigo(longitud=8)
        assert len(codigo) == 8
        assert codigo.isdigit()

    def test_calcular_expiracion_futuro(self):
        """calcular_expiracion retorna una fecha en el futuro."""
        from auth_service.email_service import calcular_expiracion
        expira = calcular_expiracion()
        ahora = datetime.now(timezone.utc)
        assert expira > ahora

    def test_calcular_expiracion_rango_correcto(self):
        """La expiración está entre 14 y 16 minutos en el futuro (por defecto 15)."""
        from auth_service.email_service import calcular_expiracion
        ahora = datetime.now(timezone.utc)
        expira = calcular_expiracion()
        diferencia = (expira - ahora).total_seconds()
        assert 14 * 60 <= diferencia <= 16 * 60


# ==========================================
# Tests de los modelos Pydantic
# ==========================================
class TestModels:
    """Tests para los modelos de request/response."""

    def test_registro_request_valido(self):
        """RegistroRequest acepta datos válidos."""
        from auth_service.models import RegistroRequest
        datos = RegistroRequest(
            nombre="Juan Pérez",
            correo="juan@test.com",
            contrasena="password123",
            fecha_nacimiento=date(2000, 5, 15)
        )
        assert datos.nombre == "Juan Pérez"
        assert datos.correo == "juan@test.com"

    def test_registro_request_correo_invalido(self):
        """RegistroRequest rechaza correo inválido."""
        from auth_service.models import RegistroRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            RegistroRequest(
                nombre="Test",
                correo="no-es-un-correo",
                contrasena="123456",
                fecha_nacimiento=date(2000, 1, 1)
            )

    def test_login_request_valido(self):
        """LoginRequest acepta datos válidos."""
        from auth_service.models import LoginRequest
        datos = LoginRequest(correo="test@test.com", contrasena="123456")
        assert datos.correo == "test@test.com"

    def test_verificacion_request_valido(self):
        """VerificacionRequest acepta datos válidos."""
        from auth_service.models import VerificacionRequest
        datos = VerificacionRequest(correo="test@test.com", codigo="123456")
        assert datos.codigo == "123456"


# ==========================================
# Tests de los endpoints (con mocks de BD)
# ==========================================
class TestEndpointsRegistro:
    """Tests para el endpoint POST /auth/registro."""

    def _get_client(self):
        """Crea un TestClient de FastAPI para los tests."""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from auth_service.main import auth_router
        app = FastAPI()
        app.include_router(auth_router)
        return TestClient(app)

    @patch("auth_service.main.conectar")
    @patch("auth_service.main.enviar_codigo_verificacion", return_value=True)
    def test_registro_exitoso(self, mock_email, mock_conectar):
        """Registro con datos válidos retorna 200 y verificacion_pendiente."""
        # Mock de la conexión y queries
        mock_conn = MagicMock()
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=False)
        # No existe usuario previo
        mock_conn.execute.return_value.fetchone.side_effect = [None, (1,)]
        mock_conectar.return_value = mock_conn

        client = self._get_client()
        resp = client.post("/auth/registro", json={
            "nombre": "Test User",
            "correo": "test@example.com",
            "contrasena": "password123",
            "fecha_nacimiento": "2000-01-01"
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["verificacion_pendiente"] is True

    def test_registro_menor_de_edad(self):
        """Registro con menor de 18 años retorna 400."""
        client = self._get_client()
        resp = client.post("/auth/registro", json={
            "nombre": "Menor",
            "correo": "menor@example.com",
            "contrasena": "password123",
            "fecha_nacimiento": "2020-01-01"
        })
        assert resp.status_code == 400
        assert "18 años" in resp.json()["detail"]

    def test_registro_contrasena_corta(self):
        """Registro con contraseña < 6 caracteres retorna 400."""
        client = self._get_client()
        resp = client.post("/auth/registro", json={
            "nombre": "Test",
            "correo": "test@example.com",
            "contrasena": "123",
            "fecha_nacimiento": "2000-01-01"
        })
        assert resp.status_code == 400
        assert "6 caracteres" in resp.json()["detail"]

    @patch("auth_service.main.conectar")
    def test_registro_correo_duplicado_verificado(self, mock_conectar):
        """Registro con correo ya verificado retorna 409."""
        mock_conn = MagicMock()
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=False)
        # Simula usuario existente Y verificado
        mock_conn.execute.return_value.fetchone.return_value = (1, True)
        mock_conectar.return_value = mock_conn

        client = self._get_client()
        resp = client.post("/auth/registro", json={
            "nombre": "Duplicado",
            "correo": "existe@example.com",
            "contrasena": "password123",
            "fecha_nacimiento": "2000-01-01"
        })
        assert resp.status_code == 409


class TestEndpointsLogin:
    """Tests para el endpoint POST /auth/login."""

    def _get_client(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from auth_service.main import auth_router
        app = FastAPI()
        app.include_router(auth_router)
        return TestClient(app)

    @patch("auth_service.main.conectar")
    def test_login_exitoso(self, mock_conectar):
        """Login con credenciales correctas retorna JWT."""
        from auth_service.security import hash_password
        hashed = hash_password("password123")

        mock_conn = MagicMock()
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=False)
        mock_conn.execute.return_value.fetchone.return_value = (
            1, "Test User", hashed, True  # id, nombre, hash, verificado
        )
        mock_conectar.return_value = mock_conn

        client = self._get_client()
        resp = client.post("/auth/login", json={
            "correo": "test@example.com",
            "contrasena": "password123"
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["nombre"] == "Test User"

    @patch("auth_service.main.conectar")
    def test_login_correo_inexistente(self, mock_conectar):
        """Login con correo que no existe retorna 401."""
        mock_conn = MagicMock()
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=False)
        mock_conn.execute.return_value.fetchone.return_value = None
        mock_conectar.return_value = mock_conn

        client = self._get_client()
        resp = client.post("/auth/login", json={
            "correo": "noexiste@example.com",
            "contrasena": "password123"
        })
        assert resp.status_code == 401

    @patch("auth_service.main.conectar")
    def test_login_contrasena_incorrecta(self, mock_conectar):
        """Login con contraseña incorrecta retorna 401."""
        from auth_service.security import hash_password
        hashed = hash_password("password_real")

        mock_conn = MagicMock()
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=False)
        mock_conn.execute.return_value.fetchone.return_value = (
            1, "Test", hashed, True
        )
        mock_conectar.return_value = mock_conn

        client = self._get_client()
        resp = client.post("/auth/login", json={
            "correo": "test@example.com",
            "contrasena": "password_incorrecta"
        })
        assert resp.status_code == 401

    @patch("auth_service.main.conectar")
    def test_login_cuenta_no_verificada(self, mock_conectar):
        """Login con cuenta no verificada retorna 403."""
        from auth_service.security import hash_password
        hashed = hash_password("password123")

        mock_conn = MagicMock()
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=False)
        mock_conn.execute.return_value.fetchone.return_value = (
            1, "Test", hashed, False  # verificado = False
        )
        mock_conectar.return_value = mock_conn

        client = self._get_client()
        resp = client.post("/auth/login", json={
            "correo": "test@example.com",
            "contrasena": "password123"
        })
        assert resp.status_code == 403
        assert "verificad" in resp.json()["detail"].lower()


class TestEndpointsVerificacion:
    """Tests para los endpoints de verificación de cuenta."""

    def _get_client(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from auth_service.main import auth_router
        app = FastAPI()
        app.include_router(auth_router)
        return TestClient(app)

    @patch("auth_service.main.conectar")
    def test_verificar_codigo_correcto(self, mock_conectar):
        """Verificación con código correcto retorna éxito."""
        mock_conn = MagicMock()
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=False)

        expira_futuro = datetime.now(timezone.utc) + timedelta(minutes=10)
        mock_conn.execute.return_value.fetchone.side_effect = [
            (1, False),  # usuario existe, no verificado
            (10, "123456", expira_futuro),  # código válido
        ]
        mock_conectar.return_value = mock_conn

        client = self._get_client()
        resp = client.post("/auth/verificar", json={
            "correo": "test@example.com",
            "codigo": "123456"
        })
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    @patch("auth_service.main.conectar")
    def test_verificar_codigo_incorrecto(self, mock_conectar):
        """Verificación con código incorrecto retorna 400."""
        mock_conn = MagicMock()
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=False)

        expira_futuro = datetime.now(timezone.utc) + timedelta(minutes=10)
        mock_conn.execute.return_value.fetchone.side_effect = [
            (1, False),  # usuario existe, no verificado
            (10, "654321", expira_futuro),  # código diferente
        ]
        mock_conectar.return_value = mock_conn

        client = self._get_client()
        resp = client.post("/auth/verificar", json={
            "correo": "test@example.com",
            "codigo": "000000"
        })
        assert resp.status_code == 400

    @patch("auth_service.main.conectar")
    def test_verificar_correo_inexistente(self, mock_conectar):
        """Verificación con correo que no existe retorna 404."""
        mock_conn = MagicMock()
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=False)
        mock_conn.execute.return_value.fetchone.return_value = None
        mock_conectar.return_value = mock_conn

        client = self._get_client()
        resp = client.post("/auth/verificar", json={
            "correo": "noexiste@example.com",
            "codigo": "123456"
        })
        assert resp.status_code == 404


class TestEndpointsLogout:
    """Tests para el endpoint POST /auth/logout."""

    def _get_client(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from auth_service.main import auth_router
        app = FastAPI()
        app.include_router(auth_router)
        return TestClient(app)

    def test_logout_retorna_exito(self):
        """Logout siempre retorna éxito (invalidación del lado del cliente)."""
        client = self._get_client()
        resp = client.post("/auth/logout")
        assert resp.status_code == 200
        assert resp.json()["success"] is True


class TestPermisos:
    """Tests de permisos: acceso a endpoints protegidos con/sin JWT."""

    def test_acceso_con_token_valido(self):
        """get_current_user con token válido retorna el user_id correcto."""
        from auth_service.security import create_access_token, get_current_user
        token = create_access_token(data={"sub": "5", "nombre": "Test"})
        assert get_current_user(token=token) == 5

    def test_acceso_sin_token(self):
        """get_current_user sin token lanza 401."""
        from auth_service.security import get_current_user
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            get_current_user(token=None)
        assert exc.value.status_code == 401

    def test_acceso_con_token_expirado(self):
        """get_current_user con token expirado lanza 401."""
        from auth_service.security import create_access_token, get_current_user
        from fastapi import HTTPException
        token = create_access_token(
            data={"sub": "5"},
            expires_delta=timedelta(seconds=-10)
        )
        with pytest.raises(HTTPException) as exc:
            get_current_user(token=token)
        assert exc.value.status_code == 401

    def test_acceso_con_token_sin_sub(self):
        """get_current_user con token sin 'sub' lanza 401."""
        from auth_service.security import create_access_token, get_current_user
        from fastapi import HTTPException
        token = create_access_token(data={"nombre": "Test"})
        with pytest.raises(HTTPException) as exc:
            get_current_user(token=token)
        assert exc.value.status_code == 401
