# Spec: auth-login

## Purpose
Permitir que un usuario inicie sesión con sus credenciales y obtenga una sesión valida.

## Requirements

### El sistema SHALL autenticar con usuario y contraseña
- SHALL rechazar credenciales invalidas sin revelar cual campo fallo.
- SHALL limitar intentos fallidos (rate limit) para frenar fuerza bruta.

#### Scenario: login exitoso
- **Given** un usuario activo con su contraseña correcta
- **When** envía usuario + contraseña validos
- **Then** recibe una sesión valida y es redirigido a su inicio

#### Scenario: credenciales invalidas
- **Given** un usuario que ingresa una contraseña incorrecta
- **When** envía el formulario
- **Then** ve "usuario o contraseña incorrectos" (sin decir cual) y no obtiene sesión

### El sistema SHALL expirar la sesión tras una duración configurable
#### Scenario: sesión vencida
- **Given** una sesión mas vieja que la duración configurada
- **When** el usuario hace una acción
- **Then** se le pide iniciar sesión de nuevo
