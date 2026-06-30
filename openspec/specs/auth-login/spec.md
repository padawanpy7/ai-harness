# Spec: auth-login

## Purpose
Permitir que un usuario inicie sesion con sus credenciales y obtenga una sesion valida.

## Requirements

### El sistema SHALL autenticar con usuario y contraseña
- SHALL rechazar credenciales invalidas sin revelar cual campo fallo.
- SHALL limitar intentos fallidos (rate limit) para frenar fuerza bruta.

#### Scenario: login exitoso
- **Given** un usuario activo con su contraseña correcta
- **When** envia usuario + contraseña validos
- **Then** recibe una sesion valida y es redirigido a su inicio

#### Scenario: credenciales invalidas
- **Given** un usuario que ingresa una contraseña incorrecta
- **When** envia el formulario
- **Then** ve "usuario o contraseña incorrectos" (sin decir cual) y no obtiene sesion

### El sistema SHALL expirar la sesion tras una duracion configurable
#### Scenario: sesion vencida
- **Given** una sesion mas vieja que la duracion configurada
- **When** el usuario hace una accion
- **Then** se le pide iniciar sesion de nuevo
