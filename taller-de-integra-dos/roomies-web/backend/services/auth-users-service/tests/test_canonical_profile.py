from dataclasses import replace
from datetime import date
from io import BytesIO
from unittest.mock import Mock
from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image
import httpx
import pytest

from app.api.routes import canonical_profile as api
from app.application.local_users import Users
from app.domain.local_users import User
from app.infrastructure.profile_images import ProfileImages, validate
from backend.service_runtime.contracts import DependencyUnavailable
from backend.service_runtime.http import configure

SUBJECT=UUID('2c36b725-ab10-4bc6-85c3-1a1966ce6961')


@pytest.fixture
def setup():
    repo=Mock()
    state={'user':User(17,SUBJECT,'Persona',date(2000,1,1),foto_perfil='/imagenes/old.png')}
    repo.get.side_effect=lambda _:state['user']
    repo.ensure.side_effect=lambda *_:state['user']
    repo.profile_fields.return_value={'genero':None,'id_region_interes':None,'id_comuna_interes':None}
    def patch(_, changes):
        state['user']=replace(state['user'],**changes)
        return state['user']
    repo.patch.side_effect=patch
    repo.swap_photo.side_effect=lambda subject,reference:patch(subject,{"foto_perfil":reference})
    app=FastAPI();configure(app);app.include_router(api.router)
    app.dependency_overrides[api.identity]=lambda:(SUBJECT,True)
    app.dependency_overrides[api.users]=lambda:Users(repo)
    storage=Mock();storage.upload.return_value=f'https://example.supabase.co/storage/v1/object/public/perfiles/{SUBJECT}/new.png'
    app.dependency_overrides[api.images]=lambda:storage
    return TestClient(app),repo,storage,state,app


def test_profile_is_own_and_has_no_private_fields(setup):
    client,repo,_,_,_=setup
    result=client.get('/api/usuarios/me?id_usuario=999')
    assert result.status_code==200
    assert result.json()['correo_verificado'] is True
    assert 'supabase_user_id' not in result.json()
    repo.get.assert_called_with(SUBJECT)
    assert result.headers['cache-control']=='no-store'


@pytest.mark.parametrize('changes',[{}, {'edad':99},{'foto_perfil':'https://evil.test/a.png'}, {'genero':'admin'}, {'ocupacion':'Administrador'}, {'id_region_interes':'9'}, {'sobre_mi':'a'*2001},{'breve_descripcion':'a'*161},{'ciudad':'\x00'}])
def test_patch_rejects_foreign_and_invalid_fields(setup,changes):
    client,repo,*_=setup
    assert client.patch('/api/usuarios/me',json=changes).status_code==422
    repo.patch_canonical.assert_not_called()


def test_patch_preserves_explicit_null_and_requires_confirmed_email(setup):
    client,repo,_,_,app=setup
    assert client.patch('/api/usuarios/me',json={'sobre_mi':None,'genero':'Otro'}).status_code==200
    assert repo.patch_canonical.call_args.args[1]=={'sobre_mi':None,'genero':'Otro'}
    app.dependency_overrides[api.identity]=lambda:(SUBJECT,False)
    assert client.patch('/api/usuarios/me',json={'ciudad':'Temuco'}).status_code==403


def test_photo_failure_keeps_old_reference_and_compensates_only_new(setup):
    client,repo,storage,state,_=setup
    repo.swap_photo.side_effect=DependencyUnavailable()
    response=client.put('/api/usuarios/me/foto',files={'foto':('foto.png',b'photo','image/png')})
    assert response.status_code==503
    assert state['user'].foto_perfil=='/imagenes/old.png'
    storage.delete_new.assert_called_once_with(storage.upload.return_value)


def test_photo_survives_new_session_and_failed_storage_does_not_update(setup):
    client,repo,storage,state,app=setup
    response=client.put('/api/usuarios/me/foto',files={'foto':('foto.png',b'photo','image/png')})
    assert response.status_code==200
    new_session=TestClient(app)
    assert new_session.get('/api/usuarios/me').json()['foto_perfil']==response.json()['foto_perfil']
    storage.upload.side_effect=DependencyUnavailable()
    repo.swap_photo.reset_mock()
    assert client.put('/api/usuarios/me/foto',files={'foto':('f.png',b'bad','image/png')}).status_code==503
    repo.swap_photo.assert_not_called()


def test_storage_checks_bytes_mime_size_and_keeps_secret_server_side(monkeypatch):
    content=BytesIO();Image.new('RGB',(2,2)).save(content,format='PNG');raw=content.getvalue()
    assert validate(raw,'image/png')=='png'
    for payload,mime in [(raw,'image/jpeg'),(b'invalid','image/png'),(b'x'*5_000_001,'image/png')]:
        with pytest.raises(Exception):validate(payload,mime)
    monkeypatch.setenv('ROOMIES_RUNTIME_MODE','supabase')
    monkeypatch.setenv('ROOMIES_LOCAL_MODE','0')
    monkeypatch.setenv('ROOMIES_SUPABASE_PROJECT_REF','abcdefghijklmnopqrst')
    monkeypatch.setenv('ROOMIES_SUPABASE_STORAGE_KEY','sb_secret_synthetic_test_only')
    original=httpx.Client;requests=[]
    def handler(request):
        requests.append(request)
        assert request.headers['apikey']=='sb_secret_synthetic_test_only'
        assert request.headers['x-upsert']=='false'
        return httpx.Response(200,json={})
    monkeypatch.setattr(httpx,'Client',lambda **kw:original(**kw,transport=httpx.MockTransport(handler)))
    url=ProfileImages().upload(SUBJECT,raw,'image/png')
    assert url.startswith(f'https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/perfiles/{SUBJECT}/')
    assert 'sb_secret' not in url


def test_initialization_is_idempotent_and_rejects_minor(setup):
    client,repo,*_=setup
    first=client.post('/api/usuarios/me',json={'nombre':'Persona','fecha_nacimiento':'2000-01-01'})
    second=client.post('/api/usuarios/me',json={'nombre':'Otra persona','fecha_nacimiento':'1999-01-01'})
    assert first.status_code==second.status_code==200
    assert first.json()['id_usuario']==second.json()['id_usuario']==17
    assert second.json()['nombre']=='Persona'
    assert first.json()['calificacion_promedio'] is None
    assert first.json()['total_evaluaciones']==0
    assert client.post('/api/usuarios/me',json={'nombre':'Menor','fecha_nacimiento':'2020-01-01'}).status_code==422
