# Spec delta: auth-login (add-remember-me)

## ADDED Requirements

### El sistema SHALL ofrecer "mantener sesion iniciada"
- SHALL emitir una sesion de duracion extendida (configurable) cuando el usuario lo marca.
- SHALL usar la duracion corta por defecto si no se marca.

#### Scenario: remember me marcado
- **Given** un login valido con "mantener sesion iniciada" marcado
- **When** se autentica
- **Then** la sesion dura la duracion extendida configurada

#### Scenario: remember me sin marcar
- **Given** un login valido sin marcarlo
- **When** se autentica
- **Then** la sesion dura la duracion corta por defecto
