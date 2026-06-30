# Proposal: add-remember-me

## Que cambia
Agregar un checkbox "Mantener sesion iniciada" en el login que extiende la duracion de la
sesion cuando el usuario lo marca.

## Por que
Los usuarios de mostrador entran muchas veces al dia; reingresar molesta. La sesion corta
los frena sin aportar seguridad real para ese caso.

## Alcance
- Frontend: checkbox en el form de login (componente del sistema, no input crudo).
- Backend: si viene marcado, emitir sesion con duracion larga (configurable).
- Specs afectadas: `auth-login`, `auth-session`.
