# Proposal: add-remember-me

## Que cambia
Agregar un checkbox "Mantener sesión iniciada" en el login que extiende la duración de la
sesión cuando el usuario lo marca.

## Por que
Los usuarios de mostrador entran muchas veces al dia; reingresar molesta. La sesión corta
los frena sin aportar seguridad real para ese caso.

## Alcance
- Frontend: checkbox en el form de login (componente del sistema, no input crudo).
- Backend: si viene marcado, emitir sesión con duración larga (configurable).
- Specs afectadas: `auth-login`, `auth-session`.
