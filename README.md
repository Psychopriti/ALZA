# ALZA

Frontend inicial de ALZA, una plataforma educativa inclusiva para personas con
discapacidad auditiva, personas oyentes y empresas.

## Estructura

- `index.html`: home publica, selector de usuario y demo de plataforma.
- `src/styles.css`: sistema visual basado en la paleta de ALZA.
- `src/app.js`: comportamiento ligero del selector de usuario.
- `public/assets`: logos y referencias visuales.
- `supabase/schema.sql`: tablas iniciales para perfiles, cursos, lecciones e inscripciones.

## Ejecutar

```bash
npm run dev
```

Luego abre `http://localhost:5173`.

Si PowerShell bloquea `npm.ps1`, usa:

```powershell
npm.cmd run dev
```

## Supabase

Corre el SQL cuando ya tengas creado el proyecto en Supabase y quieras probar
registro/inicio de sesión real. Antes de eso, la UI funciona como maqueta local.

1. Crea el proyecto en Supabase.
2. Abre el SQL Editor de Supabase.
3. Ejecuta `supabase/schema.sql` una sola vez en ese proyecto.
4. Copia tu Project URL y anon key en `src/config.js`.
5. En Authentication, para pruebas rápidas, puedes desactivar temporalmente la
   confirmación de email.
6. Prueba `Crear cuenta` e `Iniciar sesión` desde `auth.html`.

El formulario de acceso usa Supabase Auth con email y contraseña, y sincroniza
el perfil seleccionado en la tabla `profiles`. El SQL incluye un trigger para
crear el perfil automáticamente cuando se registra un usuario.

## Arquitectura

- Home pública: `index.html`.
- Pre-login por portal: `auth.html`.
- Login por portal: `login.html?role=...`.
- Registro: `register.html` o `register.html?role=...`.
- Plataforma de usuario: `platform.html`.
- Vista de curso: `course.html?course=...`.
- Super user/admin: `admin.html`.

Backend planeado en Supabase:

- `auth.users`: autenticación.
- `profiles`: rol, nombre, empresa y etiqueta `nombre-empresa`.
- `plans` y `subscriptions`: planes y compras mock.
- `courses` y `lessons`: contenido editable por super user.
- `enrollments` y `lesson_progress`: progreso tipo dashboard.

Para crear un super user:

1. Crea una cuenta normal desde la app.
2. Cambia el correo en `supabase/promote-super-user.sql`.
3. Ejecuta ese SQL en Supabase.
4. Al iniciar sesión, ese usuario será enviado a `admin.html`.
