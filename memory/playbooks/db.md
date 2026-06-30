# Playbook Base de Datos

Convenciones y aprendizajes de modelado. El rol database lo lee y lo actualiza. Sembrado con
proyectos reales (Postgres multi-tenant + RLS).

## Convenciones
- Normalizar por defecto. Desnormalizar solo con una razon medida, y dejala escrita.
- Tipos correctos (no todo `text`/`varchar`): usa `uuid`, `int`, `date`, `numeric`, enums/CHECK.
- Claves: PK uuid, FK con `REFERENCES` y `ON DELETE` pensado. UNIQUE donde corresponda.
- Multi-tenant: columna `tenant_id` + **RLS** (`current_setting('app.tenant_id')::uuid`).
  Aprovecha las columnas que tenes (ej. granularidad por `grado_id`) en vez de hardcodear.
- Toda evolucion por **migracion** versionada y reversible (up + down probados en limpio).

## Indices (con su query justificante)
- Solo indices que respaldan un query real; cuestan en escritura. Anota el query al lado.
- (sembrar con los del proyecto)

## Seguridad (no negociable — leccion cara)
- **NUNCA publicar puertos de la DB al host.** Un Postgres con el puerto publicado + pass
  debil (`postgres`/`app`) = RCE + cryptominer en horas (nos paso). Regla: nada publica
  puertos salvo el proxy; los servicios hablan por **red interna**; sin credenciales default;
  si se filtro, rotar TODO.
- RLS activa por tenant en cada tabla con `tenant_id`. Probar que un tenant no ve a otro.

## Patrones / gotchas
- `set_config('app.tenant_id', x, true)` es is_local -> requiere transaccion abierta para
  persistir entre queries (ver playbook backend). Sin tx, RLS ve "" y rompe.
- CHECK constraints: si el dominio crece (nuevo valor permitido), extende el CHECK + el schema.
- **Revisa las migraciones autogeneradas (alembic/EF) antes de aplicar**: arrastran drift no
  relacionado (una vez dropeo una columna NOT NULL). Leelas, no las apliques a ciegas.
- `docker cp` falla si el contenedor tiene rootfs read-only -> cargar datos con
  `cat archivo | docker exec -i ... psql -c "\copy tabla FROM STDIN"`.
