# Tasks: add-remember-me

- [ ] Backend: aceptar `rememberMe` en el login; elegir expiración según config.
- [ ] Backend (TDD): tests de expiración corta vs larga; edge = flag ausente -> corta.
- [ ] Frontend: checkbox "Mantener sesión iniciada" en el form (componente del sistema).
- [ ] Frontend: enviar el flag en el request de login.
- [ ] Verify: e2e login con y sin el check; revisar la expiración real en el navegador.
- [ ] Archive: mover el delta a openspec/specs/auth-login y auth-session.
