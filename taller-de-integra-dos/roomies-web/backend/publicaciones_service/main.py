from fastapi import FastAPI


app = FastAPI(
    title="Microservicio de Publicaciones",
    description="Servicio de publicaciones de ¿Hay cupo?",
    version="1.0.0",
)


@app.get("/health", tags=["Estado"])
def verificar_estado():
    return {
        "servicio": "publicaciones",
        "estado": "ok",
    }
