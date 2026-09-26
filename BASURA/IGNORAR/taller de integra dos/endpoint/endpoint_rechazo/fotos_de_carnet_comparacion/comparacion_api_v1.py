from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from deepface import DeepFace
from pathlib import Path

import cv2
import numpy as np


app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def inicio():
    return {
        "message": "Bienvenido a la API de comparación de fotos"
    }


@app.get("/api/verificacion/prueba")
def subir_verificacion():

    documento = Path("backrroms.png")
    foto = Path("granny.png")

    return {
        "documento_existe": documento.exists(),
        "foto_existe": foto.exists()
    }

def comparar_documentos(ruta1, ruta2): # Función para comparar dos imágenes utilizando ORB y BFMatcher echo por ia
                                        #cambiarle algunas cosas para mejorarlo y entenderlo mejor

    imagen1 = cv2.imread(str(ruta1), 0)
    imagen2 = cv2.imread(str(ruta2), 0)

    if imagen1 is None or imagen2 is None:
        return 0

    orb = cv2.ORB_create()

    puntos1, descripcion1 = orb.detectAndCompute(imagen1, None)
    puntos2, descripcion2 = orb.detectAndCompute(imagen2, None)

    if descripcion1 is None or descripcion2 is None:
        return 0

    comparador = cv2.BFMatcher(
        cv2.NORM_HAMMING
    )

    coincidencias = comparador.knnMatch(
        descripcion1,
        descripcion2,
        k=2
    )

    buenas = []

    for m, n in coincidencias:

        if m.distance < 0.75 * n.distance:
            buenas.append(m)

    return len(buenas)