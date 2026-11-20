from datetime import date
from unittest.mock import Mock
from uuid import uuid4
import pytest
from app.application.local_users import Users
from backend.service_runtime.contracts import RuleViolation

def test_inicializacion_no_usa_correo_ni_id_ficticio():
    repository = Mock()
    subject = uuid4()
    user = Mock(supabase_user_id=subject)
    repository.ensure.return_value = user
    assert Users(repository).initialize(subject, "Persona", date(2000, 1, 1), True) is user
    repository.ensure.assert_called_once_with(subject, "Persona", date(2000, 1, 1))

def test_no_inicializa_menor_ni_correo_sin_confirmar():
    repo = Mock()
    with pytest.raises(RuleViolation): Users(repo).initialize(uuid4(), "Persona", date(2000, 1, 1), False)
    with pytest.raises(RuleViolation): Users(repo).initialize(uuid4(), "Persona", date.today(), True)
    with pytest.raises(RuleViolation): Users(repo).initialize(uuid4(), "Persona", date(1800, 1, 1), True)
    repo.ensure.assert_not_called()

@pytest.mark.parametrize("field", ["admin", "supabase_user_id", "id_usuario", "fecha_nacimiento", "nombre", "edad"])
def test_perfil_no_promueve_privilegios_ni_cambia_identidad(field):
    subject = uuid4()
    repo = Mock()
    repo.get.return_value = Mock(supabase_user_id=subject)
    with pytest.raises(RuleViolation): Users(repo).update(subject, {field: "intruso"})
    repo.patch.assert_not_called()

def test_repositorio_debe_devolver_perfil_del_subject():
    repo = Mock()
    repo.get.return_value = Mock(supabase_user_id=uuid4())
    with pytest.raises(RuleViolation) as error: Users(repo).own(uuid4())
    assert error.value.status == 403
