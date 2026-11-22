# Base de Convivencia - incorporación v1

Base ejecutable del release inicial. Incluye contrato HTTP, persistencia propia,
índices de unicidad, control transaccional de cupos y recuperación durable.
No acredita admisión integrada ni el módulo completo de convivencia/mensajería.

Los proveedores de habilitación de Identidad y reservas de Listado definidos en
`app/ports.py` están pendientes de implementación/aprobación por sus responsables.
Un proveedor ausente falla con 503, sin crear pertenencia ni inventar ocupación.
Listado sigue indicando `incorporacion_pendiente` al aceptar una postulación.

Desde `taller-de-integra-dos/roomies-web`:

```powershell
python -m pip install -r backend/services/convivencia-mensajeria-service/requirements.txt
python backend/services/run_service.py convivencia --env-file ruta/a/configuracion-privada --port 8004
docker build -f backend/services/convivencia-mensajeria-service/Dockerfile -t roomies-convivencia-base .
```

El runner valida entorno y DSN propio `CONVIVENCIA_DATABASE_URL`. La migración
`migrations/001_convivencia_schema.up.sql` requiere un rol migrador y el login
dedicado `sql_convivencia_mensajeria` sin privilegios heredados. No se aplica al
arrancar, no usa SQL de otros dominios y no modifica datos existentes.

## Contrato y recuperación

- `POST /internal/incorporaciones`: credencial `X-Roomies-Service` e
  `Idempotency-Key` UUID. Payload estricto: `id_postulacion`, `id_publicacion`,
  `id_usuario`, `version_capacidad` (enteros positivos).
- `GET /api/arriendos/mio` y `GET /api/arriendos/{id}`: identidad autenticada y
  correo confirmado. Un no integrante recibe 404.
- La reserva de Listado es firme, no caduca unilateralmente y usa la misma UUID.
  La versión/capacidad queda congelada en el arriendo para este corte.
- El ledger y la intención de reservar se confirman antes del HTTP externo.
  La transacción siguiente bloquea operación, usuario, publicación y postulación,
  reserva, incorpora y escribe outbox. Una caída antes del commit se recupera
  repitiendo la misma reserva idempotente. Si la identidad queda deshabilitada,
  primero se resuelve la reserva de esa operación y luego se encola liberación.
- El worker reanuda pendientes y entrega confirmación/liberación idempotente.
  Un rechazo local posterior a reservar escribe una compensación durable.
  Los lotes de 20 rotan por `ultimo_intento` para evitar que fallos permanentes
  impidan recuperar operaciones posteriores.
- La respuesta 201 se persiste y se repite exactamente, con
  `Idempotency-Replayed: true`. `confirmacion_publicacion: Pendiente` describe el
  recibo original; no es una consulta del estado actual de la outbox.

El health solo acredita proceso HTTP. El acta de contrato, pruebas y estado de
firma están en `docs/contracts/incorporacion.*`.
