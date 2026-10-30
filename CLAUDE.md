# Rekover — guía del proyecto

Rekover es una app web para un gimnasio y un consultorio de kinesiología.
La dueña del proyecto **no sabe programar**: explicar siempre todo en **español y con palabras simples**.

## Reglas técnicas

- Solo **HTML, CSS y JavaScript**, sin herramientas de compilación (nada de npm, bundlers, frameworks que haya que compilar).
- `index.html` va en la **raíz** del repositorio. Se publica con **GitHub Pages desde la rama `main`**.
- Diseño **primero para celular** (mobile first).
- Por ahora los datos se guardan en el navegador (**localStorage**), con **datos de ejemplo inventados**. **Nada de datos reales.**

## Marca (respetarla siempre)

| Uso | Color |
| --- | --- |
| Fondo navy | `#0D2240` |
| Secundario | `#1A4A7A` |
| Azul eléctrico (botones y destacados) | `#4AB3F4` |
| Oro (detalles) | `#F0A500` |
| Blanco (textos sobre fondo oscuro) | `#FFFFFF` |

- Títulos en **Oswald Bold** y textos en **Inter** (Google Fonts).
- Usar los **logos PNG del repositorio** (carpeta `img/`; la app busca `img/logo.png`).

## Qué tiene que hacer la app

- **Ingreso** con tres perfiles de prueba: alumna de gimnasio, paciente de kinesiología y profesor/kinesiólogo. Cada uno ve solo lo que le corresponde.
- **Gimnasio** (Musculación, Funcional, Pilates):
  - El profesor elige primero la alumna y después arma la rutina con una lista de ejercicios por músculo; series, repeticiones, peso y pausa se cambian rápido.
  - La alumna ve su rutina del día y su progreso con gráficos de peso y repeticiones reales (lo que ella registra).
- **Kinesiología**:
  - El paciente saca turno cargando nombre, DNI, obra social y patología.
  - El kinesiólogo agrega turnos y registra lo hecho en cada sesión, y el paciente lo ve.
- **Encuesta de satisfacción** en las dos partes (gimnasio y kinesiología).

## Estado actual

- Hecho: pantalla de ingreso, sección Gimnasio completa, encuesta del gimnasio.
- Pendiente: sección Kinesiología (turnos, sesiones, encuesta de kinesiología).

## Cómo está organizado el código

- `index.html` — la página principal.
- `css/estilos.css` — colores, tipografías y diseño.
- `js/datos.js` — datos de ejemplo y funciones para guardar/leer del navegador.
- `js/app.js` — las pantallas y lo que pasa al tocar cada botón.
- `img/` — logos.
