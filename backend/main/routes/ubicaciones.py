import os

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()


@router.get("/api/ubicaciones")
async def buscar_ubicaciones(
    texto: str = Query(min_length=3, max_length=250),
):
    clave = os.getenv("GEOAPIFY_API_KEY")
    if not clave:
        raise HTTPException(
            status_code=503,
            detail="Falta configurar la clave de Geoapify.",
        )

    if len(texto.strip()) < 3:
        return []

    parametros = {
        "text": texto.strip(),
        "apiKey": clave,
        "lang": "es",
        "limit": 5,
        "format": "json",
    }

    try:
        async with httpx.AsyncClient(timeout=10) as cliente:
            respuesta = await cliente.get(
                "https://api.geoapify.com/v1/geocode/autocomplete",
                params=parametros,
            )
            respuesta.raise_for_status()
            datos = respuesta.json()
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="No se pudo consultar ubicaciones.",
        ) from None

    return [
        lugar["formatted"]
        for lugar in datos.get("results", [])
        if lugar.get("formatted")
    ]
