"""Aplicación FastAPI independiente, sin importar routers del monolito."""
from fastapi import FastAPI
from app.api.routes import internal_router, router
from backend.service_runtime.http import configure

app=FastAPI(title="Roomies Match/Conexión local v1")
configure(app)
app.include_router(router)
app.include_router(internal_router)
@app.get("/health")
def health(): return {"status":"ok"}
