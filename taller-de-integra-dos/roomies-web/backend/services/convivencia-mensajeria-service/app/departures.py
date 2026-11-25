"""Retiro autorizado, con efectos locales atómicos y entrega remota durable."""
from uuid import uuid4

from psycopg.types.json import Jsonb

from app.models import ServiceError


def detail(service, rental_id, actor_id):
    publication = service.repository.publication_id(rental_id)
    owner = service.publications.owner(publication)
    allowed = owner == actor_id
    try:
        rental = service.repository.get(rental_id, actor_id, owner=allowed)
    except ServiceError as error:
        if error.status == 404:
            raise ServiceError('FORBIDDEN', 'No tienes permiso para consultar este arriendo.', 403) from None
        raise
    return {**rental, 'puede_retirar': allowed}


def withdraw(service, rental_id, actor_id, data):
    publication = service.repository.publication_id(rental_id)
    if service.publications.owner(publication) != actor_id:
        raise ServiceError('FORBIDDEN', 'Solo el dueño del aviso puede retirar integrantes.', 403)
    with service.repository.transaction() as c:
        # Same publication lock as incorporation; withdrawal cannot race a new admission.
        c.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,0))', (f'publicacion:{publication}',))
        rental = c.execute('SELECT * FROM convivencia_mensajeria.arriendo WHERE id_arriendo=%s FOR UPDATE', (rental_id,)).fetchone()
        previous = c.execute('SELECT id_expulsion FROM convivencia_mensajeria.expulsion WHERE id_arriendo=%s AND id_usuario=%s', (rental_id, data.id_usuario)).fetchone()
        key = previous['id_expulsion'] if previous else None
        if previous is None:
            member = c.execute("""SELECT * FROM convivencia_mensajeria.pertenencia
                WHERE id_arriendo=%s AND id_usuario=%s AND estado='Activa' FOR UPDATE""", (rental_id, data.id_usuario)).fetchone()
            if member is None:
                raise ServiceError('MEMBER_NOT_FOUND', 'No se encontró ese integrante activo.', 404)
            c.execute("UPDATE convivencia_mensajeria.pertenencia SET estado='Inactiva' WHERE id_pertenencia=%s", (member['id_pertenencia'],))
            c.execute("""UPDATE convivencia_mensajeria.tarea SET id_asignado=NULL
                WHERE id_arriendo=%s AND id_asignado=%s AND estado='Pendiente'""", (rental_id, data.id_usuario))
            occupied = c.execute("SELECT count(*) AS total FROM convivencia_mensajeria.pertenencia WHERE id_arriendo=%s AND estado='Activa'", (rental_id,)).fetchone()['total']
            rental = c.execute("""UPDATE convivencia_mensajeria.arriendo SET version_ocupacion=version_ocupacion+1,
                id_responsable=CASE WHEN id_responsable=%s THEN NULL ELSE id_responsable END,
                finalizado_en=CASE WHEN %s=0 THEN clock_timestamp() ELSE finalizado_en END
                WHERE id_arriendo=%s RETURNING *""", (data.id_usuario, occupied, rental_id)).fetchone()
            key = uuid4()
            c.execute("""INSERT INTO convivencia_mensajeria.expulsion(id_expulsion,id_arriendo,id_usuario,id_actor,motivo)
                VALUES(%s,%s,%s,%s,%s)""", (key, rental_id, data.id_usuario, actor_id, data.motivo))
            projection = {'id_publicacion': publication, 'id_arriendo': rental_id, 'ocupacion': occupied,
                          'version_ocupacion': rental['version_ocupacion'], 'finalizado': occupied == 0}
            notice = {'tipo': 'expulsion', 'event_key': f'expulsion:{key}', 'id_usuario': data.id_usuario, 'referencia_id': rental_id}
            for destination, payload in [('Listado', projection), ('Notificacion', notice)]:
                c.execute('INSERT INTO convivencia_mensajeria.retiro_outbox(id_expulsion,destino,payload) VALUES(%s,%s,%s)', (key, destination, Jsonb(payload)))
    # A failed delivery does not undo a committed withdrawal. Recovery retries the durable event.
    dispatch(service, key)
    rental = service.repository.get(rental_id, actor_id, owner=True)
    with service.repository.transaction() as c:
        pending = c.execute("""SELECT EXISTS(SELECT FROM convivencia_mensajeria.retiro_outbox o
            JOIN convivencia_mensajeria.expulsion e USING(id_expulsion)
            WHERE e.id_arriendo=%s AND NOT o.enviado) AS pendiente""", (rental_id,)).fetchone()['pendiente']
    return {**rental, 'puede_retirar': True, 'id_usuario_retirado': data.id_usuario, 'sincronizacion_pendiente': pending}


def dispatch(service, key=None):
    from backend.service_runtime.notifications import send_notification
    with service.repository.transaction() as c:
        condition = ' AND id_expulsion=%s' if key is not None else ''
        events = c.execute("SELECT * FROM convivencia_mensajeria.retiro_outbox WHERE NOT enviado" + condition +
            " ORDER BY ultimo_intento NULLS FIRST,id_expulsion,destino LIMIT 20 FOR UPDATE SKIP LOCKED", (key,) if key is not None else ()).fetchall()
        for event in events:
            c.execute('UPDATE convivencia_mensajeria.retiro_outbox SET ultimo_intento=clock_timestamp() WHERE id_expulsion=%s AND destino=%s', (event['id_expulsion'], event['destino']))
            try:
                if event['destino'] == 'Listado':
                    service.publications.departure(event['payload'])
                else:
                    send_notification(event['payload'])
            except Exception:
                continue
            c.execute('UPDATE convivencia_mensajeria.retiro_outbox SET enviado=true WHERE id_expulsion=%s AND destino=%s', (event['id_expulsion'], event['destino']))
