# Playbook Backend / API

Convenciones y aprendizajes de backend. El rol backend lo lee y lo actualiza. Sembrado con
proyectos reales (.NET minimal APIs + EF Core + Dapper; FastAPI).

## Forma de la API
- **Contrato primero**: que recibe, que devuelve, códigos de estado, forma del error.
  Consistente en toda la API (mismo shape de error, misma paginación).
- .NET: minimal APIs + EF Core para ABM, Dapper para consolidación/dashboard (queries pesadas).
- Devolve solo lo que el front usa. Sin N+1 (pídele al rol database el indice que necesitas).

## Validación y seguridad
- **Valida toda entrada del front** (tipos, rangos, permisos): nunca confíes en el cliente.
- **Autoriza cada operación** y filtra por tenant/usuario: nunca devuelvas datos de otro.
- Errores **seguros**: sin stack traces ni secretos al cliente. Autentica lo util del lado server.

## Patrones / gotchas (caros de aprender)
- **System.Text.Json serializa PROPERTIES, no fields.** Un DTO que va por JSON DEBE usar
  `{ get; set; }`; con campos públicos sale `{}` vacío y el front "no recibe nada".
- **RLS por tenant en EF/Postgres**: `set_config('app.tenant_id', ..., true)` es is_local ->
  **solo persiste dentro de una transacción**. Patron: abrir `BeginTransactionAsync()` ANTES
  de configurar el tenant y de cualquier query a tablas con RLS. Sin tx, el GUC queda "" y el
  cast `''::uuid` revienta (22P02). (Tablas sin RLS andan sin tx, por eso confunde.)
- **POST de upsert**: borrar por la clave (`ExecuteDelete` de periodo+sección) y reinsertar,
  para que el guardado sea un reemplazo limpio (no duplica ni deja huérfanos).
- **CHECK constraints**: si agregas un valor nuevo (ej. un nuevo sexo 'T'), extiende el CHECK
  o el INSERT da 23514. Versiónalo en el schema.
- **Keycloak**: un usuario creado con pass temporal + required action VERIFY_PROFILE bloquea
  el direct grant ("Account is not fully set up"). Fix: `set-password` no-temporal (>=8,
  cumpliendo la policy) + `requiredActions=[]` + email verificado.

## Entornos / infra
- **Cloudflare puede bloquear scripts desde el host** (error 1010 / 403): corre los scripts
  contra la API por la **red interna** (un contenedor en la misma red docker), no por el dominio publico.
- Eventos (event-driven): outbox + eventos **auto-descriptivos** (cada linea trae lo que el
  consumidor necesita) para no leer la DB de otro contexto. Read models por contexto.
