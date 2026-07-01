# Playbook UI/UX

Best practices que se acumulan. El ui-designer lo lee antes de diseñar y lo actualiza al
aprobarse algo. Sembrado con lo aprendido en proyectos reales.

## Sistema de diseño
- **Tokens en CSS variables**, no colores sueltos: `--accent`, `--accent-deep`, `--ink`,
  `--muted`, `--line`, `--surface`, `--field-bg`, `--ok`, `--warn`, `--danger`. Cambiar el
  tema = cambiar variables. (SIRA: teal #15485f. core-erp: terracota #c4502f sobre crema.)
- **Tipografía con carácter**: un display serif (Fraunces) + un sans de cuerpo (Schibsted).
  Evitar Inter/Arial/Roboto por defecto.
- Inputs h-9/h-11 redondeados, borde `--line`, focus en `--accent`. Consistencia > novedad.

## Preview (revisión visual barata)
- **Ruta `/preview`**: una página que dibuja el sistema de diseño en todos sus estados
  (muestras de tokens, logo/íconos, botones, campos, chips, indicadores de estado) y un toggle
  claro/oscuro propio. Sin datos ni sesión. Sirve para revisar diseño (colores, un ícono nuevo,
  un widget) al instante, en vez de tener que iniciar sesión con el usuario justo y buscar el
  estado real. El verifier/lead saca un screenshot a archivo de ahí.
- **Componentes con datos = separar presentación de la carga.** Un `XView({estado, ...props})`
  puro (que se ve en `/preview`) + un `X()` que trae los datos y dibuja el View. Así todos los
  estados (vacío, cargando, error, cada variante) se ven sin montar el backend.

## Componentes (no reinventar)
- **Prohibir `<input>/<select>/<table>` crudos en las pantallas** (eslint rule). Usar los
  componentes del sistema: Campo/CampoTexto/CampoNumero/Select/AutoForm. Asi todo valida y
  se ve igual.
- Listas con **AG-Grid**; formularios con un **AutoForm/FormDinamico**. Números con
  **AutoNumeric + imask** (formato miles es-PY, mascaras). No formatear a mano.
- Selectores **en cascada** cuando hay jerarquía (ej. Ciclo -> Grado -> Sección): el de
  abajo se filtra por el de arriba y arranca deshabilitado.

## Flujo / estado
- **Leer rol e identidad del access_token (síncrono), no esperar a /perfil**: evita el
  parpadeo del menu y de los selectores (un hook tipo `useFijo`). El /perfil queda de respaldo.
- **Home guiado por rol**: el que carga ve un checklist por pasos con estado real
  (hecho/pendiente/bloqueado); el que supervisa ve un panel de estado, no la grilla cruda.
- **Menu por grupos claros y pocos** (ej. Resultados / Por institución / Configurar X), no
  un grupo gigante mezclado. Numerar el flujo cuando hay secuencia (1. .. 2. ..).
- Reportes/PDF: **membrete** (contexto: quien/que/periodo) + secciones en bandas, no una
  tabla plana sin cabecera.

## Anti-patrones (evitar)
- Mandar dos veces el header `content-type` en fetch -> 415 que rompe TODOS los forms.
  Normalizar con `new Headers()` y configurar solo si falta.
- Anchos de pagina distintos por pantalla -> al navegar "salta". Unificar el contenedor.
- Texto que parpadea/cambia al entrar -> casi siempre es esperar un fetch que debió salir
  del token. Render instantáneo desde el token.
- Comentarios y acentos fuera de convención (en estos repos: ASCII salvo Año/Mañana).
