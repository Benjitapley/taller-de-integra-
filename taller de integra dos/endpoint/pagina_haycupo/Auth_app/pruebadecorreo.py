from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from verificacion_correo import router, iniciar_verificacion

BASE = Path(__file__).resolve().parent


@asynccontextmanager
async def lifespan(app: FastAPI):
    iniciar_verificacion()
    yield


app = FastAPI(lifespan=lifespan)
app.include_router(router)

app.mount(
    "/auth",
    StaticFiles(directory=BASE),
    name="auth",
)


@app.get("/")
def inicio():
    return RedirectResponse(url="/auth/auth_app.html")