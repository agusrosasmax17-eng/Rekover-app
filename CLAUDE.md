# Rekover — guía del proyecto

Rekover es una app web para un gimnasio y un consultorio de kinesiología.
La dueña del proyecto **no sabe programar**: explicar siempre todo en **español y con palabras simples**.

## Reglas técnicas

- Solo **HTML, CSS y JavaScript**, sin herramientas de compilación (nada de npm, bundlers, frameworks que haya que compilar).
- `index.html` va en la **raíz** del repositorio. Se publica con **GitHub Pages desde la rama `main`**.
- Diseño **primero para celular** (mobile first).
- Los datos se guardan en **Firebase** (plan gratis Spark): ingreso con **Firebase Authentication** (correo y contraseña) y datos en **Cloud Firestore** (São Paulo). La librería se carga desde `https://www.gstatic.com/firebasejs/10.14.1/` (sin instalar nada).
- Por ahora solo **datos de ejemplo inventados**. **Nada de datos reales** hasta tener el consentimiento de las personas y la consulta legal (Ley 25.326: los datos de salud son sensibles).
- La seguridad la dan las reglas de `firestore.rules`: si se cambian, hay que pegarlas de nuevo en Firebase → Firestore Database → Reglas → Publicar.
- Nunca poner en el repositorio claves privadas o "cuentas de servicio" de Firebase. La configuración de `js/config.js` es pública y está bien que esté.

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

## Lenguaje

- En la app se dice **"alumnos"** (hay alumnos y alumnas). Por dentro, el código y la base de datos siguen usando `alumna`/`alumnas` para no perder los datos ya cargados: no renombrar la colección.

## Estado actual

- Hecho:
  - Ingreso con usuario o DNI y contraseña (la pantalla no muestra datos de nadie).
  - El profesor crea a la alumna (nombre, DNI, disciplina). La app genera un **código de primer ingreso** de 8 números; la alumna entra con DNI + código y crea su propia contraseña. "Restablecer" genera un código nuevo (crea una cuenta nueva en Firebase y la vieja pierde el acceso).
  - Si no hay alumnas, el profesor puede cargar 3 alumnas de ejemplo con un botón.
  - Evaluación inicial por alumna (datos, objetivo, nivel, antecedentes, observaciones y tests/ejercicios con resultado; el profesor puede crear tests propios). La alumna la ve en Progreso, sin poder cambiarla.
  - Gimnasio para Musculación y Funcional. El profesor puede repetir ejercicios y crear ejercicios propios.
  - La alumna registra series, repeticiones, peso y pausa. Elige la fecha con un calendario: puede anotar hoy o cualquier día anterior (los días futuros solo se pueden mirar).
  - El alumno también puede armar o cambiar su propia rutina desde su pantalla ("Cambiar mi rutina de este día"): elige si el cambio es solo para esa fecha o para todas las semanas. Puede agregar, quitar, ajustar y **cambiar un ejercicio por otro**. El profesor ve esos ejercicios con la etiqueta "Cambio del alumno". El alumno puede crear ejercicios propios solo para su rutina (no se suman a la lista compartida del profesor).
  - Notificaciones dentro de la app (campanita con numerito, se actualiza sola mientras la app está abierta): el profesor recibe un aviso cuando un alumno registra lo que hizo, cambia su rutina o responde la encuesta; el alumno recibe un aviso cuando el profesor cambia su rutina, su evaluación o su mensaje. El mismo aviso no se repite antes de 10 minutos. Las notificaciones que suenan en el celular con la app cerrada (push) necesitarían el plan Blaze de Firebase: no están hechas.
  - Rutina semanal: lo que el profesor arma para un día de la semana se repite todas las semanas. Además puede cambiar una fecha puntual ("Modificar solo esta fecha") sin tocar las demás semanas, y volver a la semanal cuando quiera.
  - Progreso solo en kg: mejor peso, máx. repeticiones, aumento desde el inicio, explicación en palabras y mensaje del profesor.
  - Encuesta del gimnasio.
- Pilates: "Próximamente".
- Pendiente: sección Kinesiología (turnos, sesiones, encuesta de kinesiología).

## Cuentas

- **Profesor**: se ingresa con el usuario `profesor`. Por dentro es la cuenta `profesor@rekover.app`, creada a mano en Firebase → Authentication → Users (la contraseña la eligió la dueña). Ese correo está en `js/config.js` y en `firestore.rules`.
- **Alumnas**: ingresan con su DNI. Por dentro, Firebase les asigna un correo inventado (`DNI.algo@alumnas.rekover.app`) que se busca en `accesos/{dni}`.
- **Paciente**: todavía no tiene cuenta (Kinesiología es el próximo paso).

## Cómo están guardados los datos (Firestore)

- `accesos/{dni}` → qué cuenta usa cada DNI.
- `alumnas/{id}` → nombre, DNI, disciplina, cuenta (`uid`), código de primer ingreso, `rutinas` (semanal: clave 0–6 = domingo–sábado), `cambios` (rutinas especiales por fecha `AAAA-MM-DD`), evaluación inicial y mensaje del profe.
- `alumnas/{id}/registros/{fecha_ejercicio}` → lo que registró la alumna.
- `alumnas/{id}/avisos/{id}` → notificaciones para el alumno (las crea el profesor).
- `avisosProfe/{id}` → notificaciones para el profesor (las crean los alumnos).
- `encuestas/{id}` → respuestas de la encuesta.
- `config/ejercicios` → ejercicios propios del profesor.

## Cómo está organizado el código

- `index.html` — la página principal.
- `css/estilos.css` — colores, tipografías y diseño.
- `js/datos.js` — listas fijas (ejercicios, tests, días) y alumnas de ejemplo.
- `js/config.js` — configuración pública de Firebase y correo del profesor.
- `js/servidor.js` — todo lo que se lee o guarda en Firebase.
- `js/app.js` — las pantallas y lo que pasa al tocar cada botón.
- `firestore.rules` — reglas de seguridad de la base de datos.
- `img/` — logos e ícono de la marca.
