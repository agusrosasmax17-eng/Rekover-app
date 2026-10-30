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
- Usar los **logos PNG del repositorio** (carpeta `img/`).

## Manual de Marca Rekover (v1.0, Ataraxia Systems™) — resumen

Rekover es **Sports Recovery**. El PDF del manual es confidencial: no subirlo al repositorio (que puede ser público); acá va lo necesario.

**Logos** (en `img/`, PNG con fondo transparente):
- `rekover_isologotipo.png` — K + texto. **Variante principal**: encabezados y pantalla de ingreso.
- `rekover_isotipo.png` — solo la K. Ícono de la pestaña, avatar, marca de agua. Debe reconocerse a 40 px.
- `rekover_logotipo.png` — solo texto. Documentos y firmas. Nunca como ícono/avatar.
- `icono.png` — isotipo sobre fondo navy sólido (favicon).
- Los PNG se sacaron del PDF y tienen poca resolución: si llegan los originales, reemplazarlos con el mismo nombre.

**Reglas del logo**: solo sobre navy `#0D2240` o blanco puro (el texto "KOVER" es blanco, así que en esta app va sobre navy). Dejar aire alrededor (espacio de respiro = altura de la K). Nunca estirar, aplastar, rotar, cambiar colores, poner sombras/brillos/3D, degradé, contorno ni transparencias. No cambiar la posición de la K respecto del texto.

**Roles de color**:
- Navy oscuro `#0D2240`: fondo dominante, headers, fondos de cards.
- Navy medio `#1A4A7A`: fondos alternativos, gradientes, capas de profundidad.
- Azul eléctrico `#4AB3F4`: botones/CTAs, destacados, íconos, líneas divisorias y flechas.
- Oro `#F0A500`: acento premium, separadores, elementos especiales (con moderación).
- Blanco `#FFFFFF`: texto sobre navy. Sobre fondos claros, texto en navy.
- Gris claro `#F4F8FC`: fondo opcional para contenido claro.

**Jerarquía tipográfica**: H1 Oswald Bold (blanco) · H2 Oswald SemiBold · H3 Oswald Bold en azul eléctrico · Texto Inter Regular · Notas chicas Inter Medium en gris sutil. No usar otras tipografías ni mezclarlas (títulos siempre Oswald, texto siempre Inter).

**Voz y tono**: experto, empático, real (resultados con números, sin promesas vacías) y directo (sin relleno). "El profesional que te devuelve a la cancha".
- Palabras que SÍ: recuperación, rendimiento, protocolo, resultado, progreso, "volvé a la cancha".
- Palabras que NO: holístico, mágico, transformacional, empoderamiento, "100% garantizado", "somos los mejores".

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

- Hecho:
  - Ingreso con usuario o DNI y contraseña (la pantalla no muestra datos de nadie).
  - Gimnasio para Musculación y Funcional. El profesor puede repetir ejercicios y crear ejercicios propios.
  - La alumna registra series, repeticiones, peso y pausa.
  - Progreso solo en kg: mejor peso, máx. repeticiones, aumento desde el inicio, explicación en palabras y mensaje del profesor.
  - Encuesta del gimnasio.
- Pilates: "Próximamente".
- Pendiente: sección Kinesiología (turnos, sesiones, encuesta de kinesiología).

## Usuarios de prueba (inventados)

| Perfil | Usuario o DNI | Contraseña |
| --- | --- | --- |
| Profesor (Lucas Pérez) | `profesor` | `rekover123` |
| Alumna (Sofía Gómez) | `30111222` | `sofia123` |
| Paciente (Martín López) | `28333444` | `martin123` |

Otras alumnas: Valentina `31222333` / `vale123`, Lucía `32444555` / `lucia123`, Martina `33555666` / `martina123`.
Las contraseñas quedan en el navegador sin protección: es solo un prototipo. Para datos reales hará falta un servidor con ingreso seguro.

## Cómo está organizado el código

- `index.html` — la página principal.
- `css/estilos.css` — colores, tipografías y diseño.
- `js/datos.js` — datos de ejemplo y funciones para guardar/leer del navegador.
- `js/app.js` — las pantallas y lo que pasa al tocar cada botón.
- `img/` — logos e ícono de la marca.
