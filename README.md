# Sistema de Presupuestos - Obra

App web estática (sin build tools ni framework) para generar y administrar presupuestos de obra, con [Supabase](https://supabase.com) como backend (base de datos + autenticación).

## Estructura

- `index.html` — UI: login + 4 pestañas (Presupuesto, Catálogo, Clientes, Historial) + modales.
- `config.js` — cliente de Supabase, estado global compartido y utilidades comunes (escape anti-XSS, toasts, confirmaciones, exportar CSV, botones con estado de carga).
- `auth.js` — login/logout con Supabase Auth.
- `core.js` — inicialización de datos maestros y navegación entre pestañas.
- `clientes.js`, `catalogo.js`, `presupuesto.js` — CRUD de cada entidad.
- `estilos.css` — estilos, diseño responsivo y estilos de impresión.
- `migraciones-bd/supabase_rls.sql` — script de seguridad para ejecutar en el proyecto de Supabase (ver abajo). No se sube al repositorio (está en `.gitignore`); consérvalo localmente o en un gestor de secretos propio.

## Cómo correrlo localmente

Es un sitio estático: basta con abrirlo con cualquier servidor de archivos (por ejemplo la extensión "Live Server" de VS Code, o `npx serve`). Abrir `index.html` directamente con doble clic también funciona, aunque algunos navegadores restringen ciertas funciones con `file://`.

## Configuración de Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Crea las tablas: `areas`, `clientes`, `conceptos`, `presupuestos`, `detalle_presupuesto` (columnas usadas por el código en `catalogo.js`, `clientes.js` y `presupuesto.js`).
3. Habilita Supabase Auth (email/contraseña) y crea al menos un usuario para poder iniciar sesión.
4. **Ejecuta `migraciones-bd/supabase_rls.sql` una sola vez** en el SQL Editor de tu proyecto. Esto activa Row Level Security (sin esto, cualquiera con la anon key puede leer/escribir tus datos sin loguearse) y crea la función `crear_presupuesto_con_detalle` usada al guardar un presupuesto.
5. Copia la URL del proyecto y la `anon key` (Project Settings → API) en `config.js`:
   ```js
   const SUPABASE_URL = 'https://tu-proyecto.supabase.co';
   const SUPABASE_KEY = 'tu-anon-key';
   ```
   La anon key está pensada para ser pública (queda visible en el navegador); la protección real de los datos la da RLS, no ocultar esta key.

## Fuera de alcance actual

- Roles de usuario (admin/operador): hoy cualquier usuario logueado tiene acceso total.
- Tests automatizados y linter/formateador: proyecto sin build tools.
