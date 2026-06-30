# Spec delta: auth-login (add-remember-me)

## ADDED Requirements

### El sistema SHALL ofrecer "mantener sesión iniciada"
- SHALL emitir una sesión de duración extendida (configurable) cuando el usuario lo marca.
- SHALL usar la duración corta por defecto si no se marca.

#### Scenario: remember me marcado
- **Given** un login valido con "mantener sesión iniciada" marcado
- **When** se autentica
- **Then** la sesión dura la duración extendida configurada

#### Scenario: remember me sin marcar
- **Given** un login valido sin marcarlo
- **When** se autentica
- **Then** la sesión dura la duración corta por defecto
