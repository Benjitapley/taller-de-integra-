"""Guardar referencias atómicamente sin una transacción distribuida con Storage."""
from hashlib import sha256
import json
from uuid import UUID, uuid4

from backend.service_runtime.contracts import RuleViolation
from app.infrastructure.image_operations import ImageOperations
from app.infrastructure.storage import validate_image


def operation_key(value):
    if value is None:
        return str(uuid4())
    try:
        parsed = UUID(value)
        if str(parsed) != value.lower():
            raise ValueError()
        return str(parsed)
    except (ValueError, TypeError, AttributeError):
        raise RuleViolation("Idempotency-Key debe ser UUID.") from None


def save_publication(service, actor, data, files, publication=None, retained=None, key=None, operations=None):
    repo, storage = service.repository, service.images
    previous = service.get(publication, actor) if publication is not None else None
    operations = operations or ImageOperations(repo)
    files = files or []
    if len(files) > 5:
        raise RuleViolation("Máximo 5 imágenes por publicación.")
    if retained is not None and (not isinstance(retained, list) or any(type(value) is not int or value < 1 for value in retained) or len(set(retained)) != len(retained)):
        raise RuleViolation("Lista de imágenes conservadas inválida.")
    if publication is None and retained:
        raise RuleViolation("No puedes conservar imágenes en una publicación nueva.")
    checked = [(content, validate_image(content, mime)) for content, mime in files]
    key = operation_key(key)
    fingerprint = sha256(json.dumps({"publication": publication, "data": data, "retained": retained,
        "files": [metadata for _, metadata in checked]}, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    with operations.lock(actor, key):
        operation = operations.operation(actor, key)
        if operation and operation["fingerprint"] != fingerprint:
            raise RuleViolation("La clave de operación ya se usó con otro contenido.", 409)
        if operation and operation["estado"] == "Complete":
            return operation["id_publicacion"]
        old = operations.images(publication) if publication is not None else []
        keep = [row["id_imagen"] for row in old] if retained is None else retained
        if not set(keep).issubset({row["id_imagen"] for row in old}):
            raise RuleViolation("Una imagen conservada no pertenece a esta publicación.", 422)
        if len(keep) + len(checked) > 5:
            raise RuleViolation("Máximo 5 imágenes entre conservadas y nuevas.")
        if operation is None:
            prefix = f"{actor}/{UUID(key).hex}"
            plan = [{**metadata, "object_path": f"{prefix}/{index}-{metadata['sha256']}.{metadata['extension']}"}
                    for index, (_, metadata) in enumerate(checked)]
            operation = operations.prepare(actor, key, fingerprint, publication, previous.get("version_imagenes", 0) if previous else 0, plan)
        else:
            operations.restart(actor, key)
        plan = operation["plan"]
        try:
            uploaded = [{**image, "url": storage.upload(image["object_path"], content, image["mime"])}
                        for image, (content, _) in zip(plan, checked, strict=True)]
            with repo.transaction():
                if publication is None:
                    publication = repo.create(actor, data)
                else:
                    current = repo.publication(publication, lock=True)
                    if current is None or current["id_usuario"] != actor:
                        raise RuleViolation("Publicación no encontrada.", 404)
                    if current.get("version_imagenes", 0) != operation["base_version"]:
                        raise RuleViolation("La publicación cambió. Recarga antes de guardar.", 409)
                    if current["tipo"] != data["tipo"]:
                        raise RuleViolation("El tipo original no puede modificarse.", 409)
                    if current["estado"] != "Disponible" and "reglas" in data and data["reglas"] != current.get("reglas", []):
                        raise RuleViolation("Solo puedes cambiar las reglas mientras la publicación esté Disponible.", 409)
                    if current["estado"] == "Activa" and data["cupos_totales"] < current["cupos_totales"]:
                        raise RuleViolation("La reducción de capacidad requiere confirmar ocupación.", 409)
                    repo.update(publication, data)
                operations.replace(publication, actor, keep, uploaded)
                operations.complete(actor, key, publication)
        except Exception:
            # El plan ya está confirmado: un corte o una limpieza fallida se recupera tras reinicio.
            for image in plan:
                try:
                    if not operations.referenced(image["object_path"]):
                        storage.delete(image["object_path"])
                except Exception:
                    pass
            raise
    try:
        cleanup_images(operations, storage, abandoned=False)
    except Exception:
        pass  # La publicación está confirmada; el worker reintenta la limpieza persistida.
    return publication


def cleanup_images(operations, storage, abandoned=True):
    cleaned = 0
    for image in operations.pending_cleanup():
        path = image["object_path"]
        try:
            if not operations.referenced(path):
                storage.delete(path)
            operations.cleaned(path)
            cleaned += 1
        except Exception:
            continue
    if abandoned:
        for operation in operations.abandoned():
            with operations.lock(operation["id_usuario"], operation["operation_key"], wait=False) as acquired:
                if not acquired:
                    continue
                current = operations.operation(operation["id_usuario"], operation["operation_key"])
                if current["estado"] != "Prepared":
                    continue
                try:
                    for image in current["plan"]:
                        if not operations.referenced(image["object_path"]):
                            storage.delete(image["object_path"])
                    operations.expire(current["id_usuario"], current["operation_key"])
                except Exception:
                    continue
    return cleaned
