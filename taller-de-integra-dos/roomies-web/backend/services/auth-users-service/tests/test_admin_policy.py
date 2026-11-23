from datetime import date
from uuid import UUID
from unittest.mock import Mock

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from app.api.routes import local_users as api
from app.application.local_users import Users
from app.domain.local_users import User
from app.infrastructure.security.local_provider import has_admin_role
from backend.service_runtime.http import configure

SUBJECT=UUID('640d20c3-9856-4ee8-a1c3-97649629a2e1')


@pytest.mark.parametrize('record,allowed',[
    ({'app_metadata':{'rol':'admin'}},True),
    ({'app_metadata':{'rol':'usuario'}},False),
    ({'user_metadata':{'rol':'admin'}},False),
    ({'app_metadata':{'role':'admin'}},False),
    ({'app_metadata':'admin'},False),
    ({'app_metadata':{'rol':'admin'},'is_anonymous':True},False),
    ({},False),
])
def test_only_authoritative_app_metadata_rol_grants_admin(record,allowed):
    assert has_admin_role(record) is allowed


def test_role_is_refreshed_and_allowlist_or_claims_do_not_override_provider(monkeypatch):
    record={'id':str(SUBJECT),'email_confirmed_at':'2026-11-01','app_metadata':{'rol':'admin'}}
    repo=Mock();repo.is_revoked.return_value=False;repo.get.return_value=User(7,SUBJECT,'Prueba',date(2000,1,1));repo.count.return_value=1
    monkeypatch.setattr(api,'PostgresUsers',lambda:repo)
    monkeypatch.setattr(api,'verified_claims',lambda _: {'sub':str(SUBJECT),'session_id':str(SUBJECT),'app_metadata':{'rol':'admin'}})
    monkeypatch.setattr(api,'provider_user',lambda *_:record)
    monkeypatch.setenv('ROOMIES_ADMIN_SUBJECTS',str(SUBJECT))
    app=FastAPI();configure(app);app.include_router(api.router)
    app.dependency_overrides[api.access_token]=lambda:'synthetic-token'
    app.dependency_overrides[api.users]=lambda:Users(repo)
    client=TestClient(app)
    assert client.get('/internal/v1/identidad').json()['administrator'] is True
    assert client.get('/internal/v1/resumen').status_code==200
    record['app_metadata']={'rol':'usuario'}
    record['user_metadata']={'rol':'admin'}
    assert client.get('/internal/v1/identidad').json()['administrator'] is False
    assert client.get('/internal/v1/resumen').status_code==403
    record['app_metadata']={'rol':'admin'};record['email_confirmed_at']=None
    assert client.get('/internal/v1/resumen').status_code==403
