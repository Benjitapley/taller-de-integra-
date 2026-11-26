"""Validate the exact synthetic footprint after each step, without connecting to PostgreSQL."""

import argparse
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path


PRIMARY = {
    "incorporacion": "id_operacion", "arriendo": "id_arriendo",
    "pertenencia": "id_pertenencia", "outbox": "id_outbox",
    "conversacion": "id_conversacion", "mensaje": "id_mensaje",
}
STAGES = ("semilla", "envio", "retiro", "cupo", "skip-locked")
MARKER = {"scrum101": "053-concurrency"}


def key(number):
    return f"00000000-0000-4000-8000-{number:012d}"


def timestamp(value):
    parsed = datetime.fromisoformat(value)
    if parsed.utcoffset() != timezone.utc.utcoffset(None):
        raise ValueError("Se esperaba una fecha con zona UTC")
    return parsed


def one(rows, **fields):
    matches = [row for row in rows if all(row.get(k) == v for k, v in fields.items())]
    if len(matches) != 1:
        raise ValueError(f"Se esperaba exactamente una fila para {fields}")
    return matches[0]


def generated(row, id_name, time_name):
    timestamp(row[time_name])
    result = {time_name: row[time_name]}
    if id_name:
        value = row[id_name]
        if type(value) is not int or value <= 0:
            raise ValueError(f"Identidad inválida: {id_name}")
        result[id_name] = value
    return result


def membership(actual, rental, number):
    row = one(actual["pertenencia"], id_operacion=key(953100 + number))
    return dict(generated(row, "id_pertenencia", "creada_en"), id_arriendo=rental,
                id_usuario=953300 + number, id_postulacion=953400 + number,
                id_operacion=key(953100 + number), estado="Activa", terminada_en=None)


def seed(actual):
    expected = {table: [] for table in PRIMARY}
    for number in range(953101, 953107):
        row = one(actual["incorporacion"], id_operacion=key(number))
        expected["incorporacion"].append(dict(
            generated(row, None, "creada_en"), id_operacion=key(number), payload=MARKER,
            etapa="ValidarIdentidad", estado="Pendiente", http_status=None, respuesta=None,
            ultimo_intento=None,
        ))
    for number in (1, 2, 3):
        publication = 953200 + number
        row = one(actual["arriendo"], id_publicacion=publication)
        rental = generated(row, "id_arriendo", "creado_en")
        expected["arriendo"].append(dict(rental, id_publicacion=publication, cupos_totales=1,
                                         version_capacidad=1, version_ocupacion=0))
        if number < 3:
            rental_id = rental["id_arriendo"]
            chat = one(actual["conversacion"], id_arriendo=rental_id)
            expected["conversacion"].append(dict(generated(chat, "id_conversacion", "creada_en"),
                                                 id_arriendo=rental_id))
            expected["pertenencia"].append(membership(actual, rental_id, number))
    for number, action in ((953105, "Confirmar"), (953106, "Liberar")):
        row = one(actual["outbox"], id_operacion=key(number), accion=action)
        identity = row["id_outbox"]
        if type(identity) is not int or identity <= 0:
            raise ValueError("Identidad inválida de outbox")
        expected["outbox"].append(dict(id_operacion=key(number), accion=action, id_outbox=identity,
                                       reserva={}, enviado=False, ultimo_intento=None))
    return expected


def keyed(snapshot, table):
    pk = PRIMARY[table]
    rows = snapshot[table]
    if not isinstance(rows, list):
        raise ValueError(f"{table}: se esperaba un arreglo")
    keys = [row[pk] for row in rows]
    if len(set(keys)) != len(keys):
        raise ValueError(f"{table}: clave primaria duplicada")
    return {row[pk]: json.dumps(row, sort_keys=True, ensure_ascii=False) for row in rows}


def validate(stage, actual, previous=None):
    if not isinstance(actual, dict) or set(actual) != set(PRIMARY):
        raise ValueError("Se requieren exactamente las seis tablas de Convivencia")
    want = seed(actual) if stage == "semilla" else deepcopy(previous)
    if stage == "envio":
        p = one(want["pertenencia"], id_usuario=953301)
        chat = one(want["conversacion"], id_arriendo=p["id_arriendo"])
        row = one(actual["mensaje"], id_cliente=key(953601))
        values = generated(row, "id_mensaje", "fecha_envio")
        if timestamp(values["fecha_envio"]) < timestamp(p["creada_en"]):
            raise ValueError("Mensaje anterior al ingreso")
        want["mensaje"].append(dict(values, id_conversacion=chat["id_conversacion"],
                                    id_remitente=953301, nombre_remitente="Actor sintético",
                                    contenido="Envío previo", id_cliente=key(953601)))
    elif stage == "retiro":
        row = one(want["pertenencia"], id_usuario=953302)
        ended = one(actual["pertenencia"], id_pertenencia=row["id_pertenencia"])["terminada_en"]
        if timestamp(ended) < timestamp(row["creada_en"]):
            raise ValueError("Intervalo inválido de retiro")
        row.update(estado="Inactiva", terminada_en=ended)
    elif stage == "cupo":
        rental = one(want["arriendo"], id_publicacion=953203)
        want["pertenencia"].append(membership(actual, rental["id_arriendo"], 3))
    elif stage not in ("semilla", "skip-locked"):
        raise ValueError("Etapa desconocida")

    for table in PRIMARY:
        if keyed(actual, table) != keyed(want, table):
            raise ValueError(f"{stage}: {table} contiene claves o valores distintos del inventario esperado")
    return want


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("captures", type=Path, nargs="+", help="JSON de cada etapa en orden, empezando por la semilla")
    args = parser.parse_args()
    if len(args.captures) > len(STAGES):
        parser.error("Demasiadas capturas")
    expected = None
    try:
        for stage, path in zip(STAGES, args.captures):
            # Preserve the exact PostgreSQL rows::text bytes for the authorized cleanup hash.
            raw = path.read_bytes().rstrip(b"\r\n")
            if b"\n" in raw or b"\r" in raw or raw.strip() != raw:
                raise ValueError("Capture una única línea UTF-8 sin modificarla")
            expected = validate(stage, json.loads(raw.decode("utf-8")), expected)
            print(f"{stage}: inventario exacto")
    except (AttributeError, KeyError, OSError, TypeError, ValueError) as exc:
        parser.exit(1, f"Inventario rechazado: {exc}\n")
    if len(args.captures) == len(STAGES):
        print(f"fixture_sha256={hashlib.sha256(raw).hexdigest()}")


if __name__ == "__main__":
    main()
