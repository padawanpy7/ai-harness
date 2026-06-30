# Design: add-remember-me

## Decisiones
- Duración: corta por defecto (ej. 8h), extendida si "remember me" (ej. 30d). Ambas en config.
- El flag viaja en el request de login; **el backend decide la expiración**, no el cliente.
- La preferencia deriva de la sesión emitida; no se guarda en una cookie aparte.

## Alternativas descartadas
- Refresh tokens largos siempre: mas superficie de riesgo si se filtra el token.

## Riesgos
- Sesión larga = mas ventana si se roba el token. Mitigación: rotación + revocación al logout.
