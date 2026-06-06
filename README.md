# ALZA

ALZA es una plataforma educativa inclusiva enfocada en accesibilidad, aprendizaje digital y gestion de cursos para personas con discapacidad auditiva, personas oyentes, empresas y administradores.

La aplicacion esta construida como una experiencia web estatica con integracion a Supabase para autenticacion, perfiles, cursos, progreso y flujos administrativos.

## Demo en produccion

La version desplegada esta disponible en:

[https://alza-web.vercel.app/](https://alza-web.vercel.app/)

## Que incluye

- Home publica con presentacion de ALZA y seleccion de tipo de usuario.
- Flujo de autenticacion y registro por rol.
- Portal de usuario con cursos, progreso y contenido educativo.
- Vista de curso con lecciones y materiales.
- Panel de super user/admin para gestion de contenido y usuarios.
- Integracion con Supabase para Auth, perfiles, cursos, lecciones, inscripciones y progreso.
- Build estatico listo para despliegue en Vercel.

## Stack

- HTML, CSS y JavaScript vanilla.
- Node.js para servidor local y scripts de build.
- Supabase para backend, autenticacion y base de datos.
- Vercel para hosting de produccion.

## Estructura del proyecto

```text
.
|-- index.html              # Home publica
|-- auth.html               # Entrada por tipo de usuario
|-- login.html              # Inicio de sesion
|-- register.html           # Registro
|-- platform.html           # Portal principal del usuario
|-- course.html             # Vista de curso
|-- admin.html              # Panel administrativo
|-- src/
|   |-- app.js              # Interacciones de la home
|   |-- platform.js         # Logica del portal
|   |-- course.js           # Logica de cursos
|   |-- admin.js            # Logica administrativa
|   |-- supabase-client.js  # Cliente de Supabase
|   |-- config.js           # Credenciales publicas de Supabase
|   `-- styles.css          # Sistema visual
|-- public/assets/          # Logos, imagenes y recursos visuales
|-- supabase/               # Schema y migraciones SQL
|-- scripts/                # Build y validacion estatica
|-- server.js               # Servidor local portable
`-- vercel.json             # Configuracion de despliegue en Vercel
```

## Requisitos

- Node.js 18 o superior.
- npm.
- Un proyecto de Supabase, solo si quieres probar autenticacion y datos reales.

## Launch local

Clona el repositorio e instala dependencias:

```bash
npm install
```

Levanta el servidor local:

```bash
npm run dev
```

Abre la aplicacion en:

[http://localhost:5173](http://localhost:5173)

Si estas en PowerShell y aparece una restriccion con `npm.ps1`, ejecuta:

```powershell
npm.cmd run dev
```

Tambien puedes usar el servidor portable directamente:

```bash
npm run dev:portable
```

## Configuracion de Supabase

La interfaz puede abrirse localmente como maqueta, pero los flujos reales de registro, inicio de sesion, perfiles, cursos y administracion dependen de Supabase.

1. Crea un proyecto en Supabase.
2. Abre el SQL Editor.
3. Ejecuta `supabase/schema.sql`.
4. Si necesitas las funcionalidades agregadas por etapas, ejecuta tambien las migraciones en `supabase/` siguiendo su numeracion.
5. Copia `src/config.example.js` como `src/config.js`.
6. Reemplaza los valores con tu Project URL y anon/public key:

```js
window.ALZA_SUPABASE_URL = "https://tu-proyecto.supabase.co";
window.ALZA_SUPABASE_ANON_KEY = "tu-anon-key";
```

Para pruebas rapidas, puedes desactivar temporalmente la confirmacion de email desde la configuracion de Authentication en Supabase.

## Usuarios y rutas principales

- Home: `index.html`
- Seleccion de portal: `auth.html`
- Login por rol: `login.html?role=...`
- Registro por rol: `register.html?role=...`
- Plataforma: `platform.html`
- Curso: `course.html?course=...`
- Administracion: `admin.html`

## Crear un super user

1. Crea una cuenta normal desde la app.
2. Abre `supabase/promote-super-user.sql`.
3. Cambia el correo por el usuario que quieres promover.
4. Ejecuta el SQL en Supabase.
5. Inicia sesion nuevamente; el usuario sera redirigido al panel `admin.html`.

## Build y validacion

Generar build estatico:

```bash
npm run build
```

Validar recursos y texto del build:

```bash
npm run validate:static
```

El build se genera en `dist/`, que es el directorio configurado como salida para Vercel.

## Despliegue

El proyecto incluye `vercel.json` con:

- `npm run build` como comando de build.
- `dist` como directorio de salida.
- Rewrite de `/` hacia `index.html`.
- Cache-Control especial para archivos en `/src`.

Produccion actual:

[https://alza-web.vercel.app/](https://alza-web.vercel.app/)
