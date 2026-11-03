/* =========================================================
   REKOVER — Pantallas y acciones
   Cada pantalla es una función que devuelve HTML.
   Cuando algo cambia, se vuelve a dibujar todo con dibujar()
   y se guarda en el servidor (ver servidor.js).
   ========================================================= */

import * as servidor from './servidor.js';
import { leerPlanilla } from './excel.js';

// Copia en memoria de lo que esta persona puede ver (se trae del servidor al ingresar)
let datos = { alumnas: [], rutinas: {}, cambios: {}, registros: [], diario: {}, encuestas: [], notasProgreso: {}, ejerciciosPropios: {}, evaluaciones: {} };
let perfil = null;
let cargando = true; // mientras se conecta con el servidor
let avisos = [];             // notificaciones de la campanita (llegan solas del servidor)
let dejarDeEscuchar = null;  // corta la escucha de notificaciones al salir

// Estado de la pantalla (qué pestaña está abierta, qué alumna está elegida, etc.)
const ui = {
  pestana: null,
  errorIngreso: '',         // mensaje si el usuario o la contraseña no coinciden
  errorAlumna: '',          // mensaje si no se pudo crear una alumna
  ocupado: false,           // mientras se espera una respuesta del servidor
  seccionAlumna: 'rutina',  // en la ficha de la alumna: 'rutina' o 'evaluacion'
  agregandoTest: false,     // si está abierto el formulario para sumar un test
  testElegido: TESTS[0][0], // test elegido en ese formulario ('otro' = crear uno propio)
  filtro: 'Todos',          // filtro de disciplina en la lista de alumnas
  alumnaId: null,           // alumna elegida por el profesor
  dia: new Date().getDay(), // día de la semana que edita el profesor en la rutina semanal
  modoRutina: 'semanal',    // el profesor edita la rutina 'semanal' o la de una 'fecha' puntual
  fechaRutina: fechaISO(),  // fecha puntual que está editando el profesor
  fecha: fechaISO(),        // fecha que está viendo/registrando la alumna
  agregando: false,         // si está abierta la lista para agregar ejercicios
  creando: false,           // si está abierto el formulario de ejercicio propio
  musculo: null,            // músculo elegido en esa lista
  nuevaAlumna: false,       // si está abierto el formulario de nueva alumna
  registrando: null,        // índice del ejercicio que el alumno está registrando
  editando: false,          // el alumno está cambiando su propia rutina
  eligiendoAlcance: false,  // el alumno elige si cambia solo ese día o todas las semanas
  reemplazando: null,       // índice del ejercicio que se está cambiando por otro
  verAvisos: false,         // está abierta la lista de notificaciones
  importacion: null,        // planilla de Excel leída, esperando que el profesor la confirme
  tipoIngreso: 'alumno',    // en la pantalla de ingreso: 'alumno' o 'entrenador'
  sensacion: null,          // carita elegida por el alumno para el día
  comentarioDia: '',        // comentario del día que está escribiendo el alumno
  editandoDiario: false,    // el alumno está cambiando la carita/comentario que ya guardó
  recien: '',               // ejercicio recién registrado (para animar el tilde)
  mes: fechaISO().slice(0, 7), // mes que ve el profesor en el calendario del progreso
  diaProfe: fechaISO(),     // día elegido por el profesor en ese calendario
  entrenadorId: null,       // entrenador elegido por la administradora
  nuevoEntrenador: false,   // formulario de entrenador nuevo abierto
  errorEntrenador: '',      // mensaje si no se pudo crear un entrenador
  ejercicioGrafico: null,   // ejercicio elegido en Progreso
  estrellas: 0,             // puntaje elegido en la encuesta
  comentario: ''            // comentario que se está escribiendo en la encuesta
};

const app = document.getElementById('app');

/* ---------- Ayudas ---------- */

// Evita que un texto escrito por el usuario rompa la página
function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Guarda en el servidor la ficha de un alumno y avisa a la otra persona (campanita).
// tipo: 'rutina', 'evaluacion' o 'nota' (para armar el texto de la notificación).
// Espera medio segundo para juntar varios toques seguidos de − / + en un solo guardado.
const guardadosPendientes = {};
const avisosPendientes = {};
function guardarFicha(alumnaId, tipo = 'rutina') {
  avisosPendientes[alumnaId] = textoDeAviso(tipo);
  clearTimeout(guardadosPendientes[alumnaId]);
  guardadosPendientes[alumnaId] = setTimeout(() => {
    delete guardadosPendientes[alumnaId];
    // El alumno solo puede guardar su rutina; el profesor guarda todo
    const ficha = { rutinas: datos.rutinas[alumnaId] || {}, cambios: datos.cambios[alumnaId] || {} };
    if (perfil.rol === 'profesor') {
      ficha.notaProgreso = datos.notasProgreso[alumnaId] || '';
      ficha.evaluacion = datos.evaluaciones[alumnaId] || null;
    }
    servidor.guardarFicha(alumnaId, ficha)
      .then(() => enviarAviso(alumnaId, avisosPendientes[alumnaId]))
      .catch(mostrarError);
  }, 500);
}

// "lunes", "martes"… "sábados", "domingos"
function diaEnPlural(dia) { return DIAS[dia].toLowerCase() + (dia === 0 || dia === 6 ? 's' : ''); }

// Texto de la notificación según quién cambió qué
function textoDeAviso(tipo) {
  const cual = ui.modoRutina === 'fecha' ? `rutina del ${fechaLarga(ui.fechaRutina)}` : `rutina de los ${diaEnPlural(ui.dia)}`;
  if (perfil.rol === 'profesor') {
    if (tipo === 'evaluacion') return 'Tu profe actualizó tu evaluación inicial.';
    if (tipo === 'nota') return 'Tu profe te dejó un mensaje sobre tu progreso.';
    if (tipo === 'importacion') return 'Tu profe cargó tu rutina nueva. ¡A entrenar!';
    return `Tu profe actualizó tu ${cual}.`;
  }
  return `${perfil.nombre} cambió su ${cual}.`;
}

// Manda la notificación a la otra persona. Si ya se mandó el mismo aviso
// hace menos de 10 minutos, no se repite (para no llenar la campanita).
const ultimosAvisos = {};
function enviarAviso(alumnaId, texto) {
  delete avisosPendientes[alumnaId];
  if (!texto) return;
  const clave = alumnaId + texto;
  if (Date.now() - (ultimosAvisos[clave] || 0) < 10 * 60e3) return;
  ultimosAvisos[clave] = Date.now();
  const envio = perfil.rol === 'profesor' ? servidor.avisarAlAlumno(alumnaId, texto) : servidor.avisarAlProfe(alumnaId, texto, perfil.entrenadorUid);
  envio.catch(e => console.error(e));
}

// Traduce los errores del servidor a mensajes simples
function mensajeError(e) {
  const codigo = e?.code || '';
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email', 'rekover/no-existe'].includes(codigo))
    return 'El usuario o la contraseña no coinciden. Revisalos e intentá de nuevo.';
  if (codigo === 'auth/too-many-requests') return 'Hubo demasiados intentos. Esperá unos minutos y probá de nuevo.';
  if (codigo === 'auth/network-request-failed' || codigo === 'unavailable') return 'No hay conexión a internet. Revisala e intentá de nuevo.';
  if (codigo === 'rekover/sin-ficha') return 'Tu cuenta no tiene una ficha asignada. Consultá con tu profe.';
  if (codigo === 'rekover/dni-repetido') return 'Ya hay un alumno con ese DNI.';
  if (codigo === 'rekover/dni-repetido-entrenador') return 'Ya hay un entrenador con ese DNI.';
  if (codigo === 'rekover/sin-ficha') return 'No encontramos tu ficha. Fijate de haber elegido bien "Soy alumno" o "Soy entrenador", o consultá con tu profe.';
  if (codigo === 'auth/requires-recent-login') return 'Por seguridad, salí y volvé a entrar con tu código para crear la contraseña.';
  if (codigo === 'permission-denied') return 'No tenés permiso para hacer esto.';
  if (codigo === 'rekover/sin-libreria-excel') return 'No se pudo abrir el lector de Excel. Revisá la conexión a internet e intentá de nuevo.';
  if (codigo === 'rekover/planilla-vacia') return 'No encontré ejercicios en la planilla. Fijate que tenga filas "DÍA 1", la fila de títulos "Ejercicio" y los ejercicios debajo.';
  if (codigo === 'auth/configuration-not-found' || codigo === 'auth/operation-not-allowed')
    return 'El ingreso con correo y contraseña no está activado en Firebase.';
  console.error(e);
  return 'Algo salió mal. Intentá de nuevo en un momento.';
}

function mostrarError(e) { mostrarAviso(mensajeError(e)); }

// Muestra un mensajito abajo por un par de segundos ("Guardado", etc.)
function mostrarAviso(texto) {
  dibujar();
  const aviso = document.getElementById('aviso');
  aviso.textContent = texto;
  aviso.classList.add('visible');
  clearTimeout(mostrarAviso.t);
  mostrarAviso.t = setTimeout(() => aviso.classList.remove('visible'), 1800);
}

function numero(n) { return String(Math.round(n * 10) / 10).replace('.', ','); }

function formatoPausa(seg) {
  const m = Math.floor(seg / 60), s = seg % 60;
  return m ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

function formatoPeso(kg) { return kg > 0 ? `${numero(kg)} kg` : 'Sin peso'; }

function formatoFecha(iso) { const [, m, d] = iso.split('-'); return `${d}/${m}`; }

function alumnaPorId(id) { return datos.alumnas.find(a => a.id === id); }

function rutinaDe(alumnaId, dia) {
  const r = datos.rutinas[alumnaId] || (datos.rutinas[alumnaId] = {});
  return r[dia] || (r[dia] = []);
}

// Día de la semana (0 = domingo) de una fecha AAAA-MM-DD
function diaDeSemana(fecha) { return new Date(fecha + 'T12:00').getDay(); }

// "viernes 30/10"
function fechaLarga(fecha) { return `${DIAS[diaDeSemana(fecha)].toLowerCase()} ${formatoFecha(fecha)}`; }

// Suma (o resta) días a una fecha AAAA-MM-DD
function sumarDias(fecha, dias) { const d = new Date(fecha + 'T12:00'); d.setDate(d.getDate() + dias); return fechaISO(d); }

// Lunes de la semana de una fecha
function lunesDe(fecha) { return sumarDias(fecha, -((diaDeSemana(fecha) + 6) % 7)); }

// Repeticiones para mostrar: "8-10" o "Al fallo" si vienen así de la planilla, o el número
function repsDe(ej) { return ej.repsTexto || ej.reps; }

// Nota de técnica del ejercicio (biserie, descendente, etc.)
function notaDe(ej) { return ej.nota ? `<p class="nota-ejercicio">${esc(ej.nota)}</p>` : ''; }

// Cambios puntuales de una alumna: { 'AAAA-MM-DD': [ejercicios] }
function cambiosDe(alumnaId) { return datos.cambios[alumnaId] || (datos.cambios[alumnaId] = {}); }

// Rutina que corresponde a una fecha: la especial de esa fecha si existe,
// y si no, la semanal de ese día de la semana
function rutinaDeFecha(alumnaId, fecha) {
  return cambiosDe(alumnaId)[fecha] || rutinaDe(alumnaId, diaDeSemana(fecha));
}

// Rutina que está editando el profesor en este momento (semanal o de una fecha puntual)
function rutinaEditable(alumnaId) {
  if (ui.modoRutina === 'fecha') return cambiosDe(alumnaId)[ui.fechaRutina] || [];
  return rutinaDe(alumnaId, ui.dia);
}

// Ejercicios de un músculo: los de la lista base más los que creó el profesor
function ejerciciosDe(disciplina, musculo) {
  const propios = datos.ejerciciosPropios[disciplina]?.[musculo] || [];
  return [...CATALOGO[disciplina][musculo], ...propios.map(e => [e.nombre, e.peso, true])];
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Cómo se sintió el alumno: [clave, carita, texto]
const SENSACIONES = [['costo', '😫', 'Me costó mucho'], ['normal', '😐', 'Normal'], ['bien', '💪', 'Bien'], ['excelente', '🔥', '¡Excelente!']];
const sensacionDe = clave => SENSACIONES.find(s => s[0] === clave) || SENSACIONES[1];

// Un ícono para cada grupo muscular
const ICONOS_MUSCULO = {
  'Pecho': '🏋️', 'Espalda': '🧗', 'Piernas': '🦵', 'Glúteos': '🍑', 'Hombros': '🤸', 'Bíceps': '💪', 'Tríceps': '💪',
  'Abdomen': '🔥', 'Core': '🔥', 'Cardio': '❤️', 'Tren superior': '💪', 'Tren inferior': '🦵'
};
const iconoMusculo = m => ICONOS_MUSCULO[m] || '⭐';

// Una frase por día (siempre la misma durante ese día)
const FRASES = [
  'No hace falta un día perfecto: hace falta venir.',
  'La fuerza se construye de a poco, semana a semana.',
  'Técnica primero, peso después.',
  'Lo que anotás, lo podés mejorar.',
  'Hoy es un buen día para superar tu marca.',
  'Descansar bien también es parte del protocolo.',
  'Cada serie suma. Hoy sumás una más.',
  'Un entrenamiento a la vez.',
  'Tu progreso de hoy es tu base de mañana.',
  'Volvé a la cancha más fuerte que antes.'
];
function fraseDelDia(fecha) {
  const n = Math.floor(new Date(fecha + 'T12:00') / 864e5);
  return FRASES[n % FRASES.length];
}

function saludoPorHora() {
  const h = new Date().getHours();
  return h < 13 ? '¡Buen día' : h < 20 ? '¡Buenas tardes' : '¡Buenas noches';
}

// Minutos aproximados de una rutina: cada serie ~40 segundos más su pausa, y un minuto entre ejercicios
function duracionAproximada(rutina) {
  const segundos = rutina.reduce((total, ej) => total + ej.series * (40 + (ej.pausa || 0)) + 60, 0);
  return Math.max(5, Math.round(segundos / 60 / 5) * 5);
}

function registroDe(alumnaId, nombre, fecha) {
  return datos.registros.find(r => r.alumnaId === alumnaId && r.nombre === nombre && r.fecha === fecha);
}

/* ---------- Festejos: confeti y vibración ---------- */

const sinMovimiento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function vibrar(patron = [30, 40, 30]) { try { navigator.vibrate?.(patron); } catch (e) { /* nada */ } }

// Confeti azul, oro y blanco (los colores de la marca) que cae por 2 segundos
function confeti() {
  if (sinMovimiento()) return;
  const lienzo = document.createElement('canvas');
  lienzo.className = 'confeti';
  lienzo.width = innerWidth * devicePixelRatio; lienzo.height = innerHeight * devicePixelRatio;
  document.body.appendChild(lienzo);
  const c = lienzo.getContext('2d');
  c.scale(devicePixelRatio, devicePixelRatio);
  const colores = ['#4AB3F4', '#F0A500', '#FFFFFF'];
  const papeles = Array.from({ length: 110 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 80, y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 12 - 4,
    giro: Math.random() * 6, vg: (Math.random() - 0.5) * 0.4,
    ancho: 6 + Math.random() * 6, alto: 4 + Math.random() * 4,
    color: colores[Math.floor(Math.random() * colores.length)]
  }));
  const inicio = performance.now();
  (function cuadro(ahora) {
    const t = ahora - inicio;
    c.clearRect(0, 0, innerWidth, innerHeight);
    papeles.forEach(p => {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.giro += p.vg;
      c.save(); c.translate(p.x, p.y); c.rotate(p.giro);
      c.globalAlpha = Math.max(0, 1 - t / 2200);
      c.fillStyle = p.color; c.fillRect(-p.ancho / 2, -p.alto / 2, p.ancho, p.alto);
      c.restore();
    });
    if (t < 2200) requestAnimationFrame(cuadro); else lienzo.remove();
  })(inicio);
}

function festejar() { confeti(); vibrar(); }

/* ---------- Movimiento al cambiar de pantalla ---------- */

// Los números con data-contar="37" cuentan desde 0 hasta su valor
function contarNumeros(contenedor) {
  if (sinMovimiento()) return;
  contenedor.querySelectorAll('[data-contar]').forEach(el => {
    const final = Number(el.dataset.contar), antes = el.dataset.antes || '', despues = el.dataset.despues || '';
    const inicio = performance.now(), duracion = 800;
    (function paso(ahora) {
      const avance = Math.min(1, (ahora - inicio) / duracion);
      const valor = final * (1 - Math.pow(1 - avance, 3)); // arranca rápido y frena suave
      el.textContent = antes + numero(Number.isInteger(final) ? Math.round(valor) : valor) + despues;
      if (avance < 1) requestAnimationFrame(paso);
    })(inicio);
  });
}

// Isologotipo (K + texto): según el manual de marca, es la variante principal.
// Se usa siempre sobre fondo navy, sin estirarlo ni agregarle efectos.
function logo(chico) {
  return `<img class="logo ${chico ? 'logo-chico' : ''}" src="img/rekover_isologotipo.png" alt="Rekover">`;
}

/* ---------- Dibujo general ---------- */

function dibujar() {
  if (cargando) { app.innerHTML = `<section class="ingreso">${logo(false)}<p class="suave">Cargando…</p></section>`; return; }
  if (!perfil) { app.innerHTML = pantallaIngreso(); return; }
  if (perfil.debeCambiarClave) { app.innerHTML = pantallaCrearClave(); return; }
  let contenido = '';
  if (ui.verAvisos) contenido = pantallaAvisos();
  else if (perfil.rol === 'alumna') contenido = pantallaAlumna();
  else if (perfil.rol === 'profesor') contenido = pantallaProfesor();
  else if (perfil.rol === 'paciente') contenido = pantallaPaciente();
  // Si cambió de pantalla (no un simple toque dentro de la misma), entra con movimiento
  const clave = [perfil.rol, ui.pestana, ui.alumnaId, ui.seccionAlumna, ui.verAvisos, ui.entrenadorId, !!ui.importacion].join('|');
  const nueva = clave !== dibujar.ultima;
  dibujar.ultima = clave;
  app.innerHTML = encabezado() + `<section class="contenido ${nueva ? 'entrando' : ''}">${contenido}</section>` + menuInferior();
  if (nueva) {
    const seccion = app.querySelector('.contenido');
    [...seccion.children].forEach((el, i) => el.style.setProperty('--orden', Math.min(i, 8)));
    contarNumeros(seccion);
  }
}

function encabezado() {
  return `<header class="encabezado">
    ${logo(true)}
    <div class="encabezado-usuario">
      <button class="campana ${ui.verAvisos ? 'activa' : ''}" data-accion="avisos" aria-label="Notificaciones">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z"/></svg>
        <span class="campana-numero">${numeroCampana()}</span>
      </button>
      <span class="encabezado-nombre">${esc(perfil.nombre)}</span>
      <button class="boton-texto" data-accion="salir">Salir</button>
    </div>
  </header>`;
}

/* ---------- Notificaciones (campanita) ---------- */

function numeroCampana() {
  const sinLeer = avisos.filter(a => !a.leido).length;
  return sinLeer ? (sinLeer > 9 ? '9+' : sinLeer) : '';
}

// Actualiza solo el numerito, sin redibujar la pantalla (para no borrar lo que se está escribiendo)
function actualizarCampana() {
  const numero = document.querySelector('.campana-numero');
  if (numero) numero.textContent = numeroCampana();
  if (ui.verAvisos) dibujar();
}

function haceCuanto(iso) {
  const minutos = Math.round((Date.now() - new Date(iso)) / 60e3);
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  if (minutos < 24 * 60) return `hace ${Math.round(minutos / 60)} h`;
  return formatoFecha(iso.slice(0, 10));
}

function pantallaAvisos() {
  return `<button class="boton-texto volver" data-accion="avisos">‹ Volver</button>
    <h1>Notificaciones</h1>
    ${avisos.map(a => {
      const irA = perfil.rol === 'profesor' && alumnaPorId(a.alumnaId);
      return `<${irA ? `button data-accion="ir-alumno" data-valor="${esc(a.alumnaId)}"` : 'div'} class="tarjeta aviso-item ${a.leido ? '' : 'nuevo'}">
        <p>${esc(a.texto)}</p><small>${haceCuanto(a.fecha)}${irA ? ' · Ver ficha ›' : ''}</small>
      </${irA ? 'button' : 'div'}>`;
    }).join('') || '<div class="tarjeta vacio">Todavía no tenés notificaciones.</div>'}`;
}

// Pestañas de abajo: cada perfil ve solo las suyas (la administradora, además, Entrenadores)
const PESTANAS = {
  alumna:   [['hoy', 'Rutina'], ['progreso', 'Progreso'], ['encuesta', 'Encuesta']],
  profesor: [['alumnas', 'Alumnos'], ['encuestas', 'Encuestas'], ['kinesio', 'Kinesio']],
  admin:    [['alumnas', 'Alumnos'], ['entrenadores', 'Entrenadores'], ['encuestas', 'Encuestas'], ['kinesio', 'Kinesio']],
  paciente: [['turnos', 'Turnos']]
};
function pestanasDe(p) { return PESTANAS[p.esAdmin ? 'admin' : p.rol]; }

function menuInferior() {
  const lista = pestanasDe(perfil);
  if (lista.length < 2) return '';
  return `<nav class="menu-inferior">${lista.map(([id, texto]) =>
    `<button class="${ui.pestana === id ? 'activa' : ''}" data-accion="pestana" data-valor="${id}">${texto}</button>`).join('')}</nav>`;
}

/* ---------- Ingreso ---------- */

function pantallaIngreso() {
  return `<section class="ingreso">
    ${logo(false)}
    <p class="ingreso-bajada">Sports Recovery</p>
    <h1>Ingresar</h1>
    <div class="tipo-ingreso">
      <button class="${ui.tipoIngreso === 'alumno' ? 'activa' : ''}" data-accion="tipo-ingreso" data-valor="alumno">Soy alumno</button>
      <button class="${ui.tipoIngreso === 'entrenador' ? 'activa' : ''}" data-accion="tipo-ingreso" data-valor="entrenador">Soy entrenador</button>
    </div>
    <form class="form-ingreso" data-form="ingreso" autocomplete="on">
      <label class="campo">${ui.tipoIngreso === 'entrenador' ? 'Usuario o DNI' : 'DNI'}
        <input name="usuario" required autocomplete="username" autocapitalize="none" ${ui.tipoIngreso === 'alumno' ? 'inputmode="numeric"' : ''}
          placeholder="${ui.tipoIngreso === 'entrenador' ? 'Tu DNI sin puntos (o tu usuario)' : 'Tu DNI sin puntos'}">
      </label>
      <label class="campo">Contraseña
        <input name="clave" type="password" autocomplete="current-password" placeholder="Tu contraseña">
      </label>
      <p class="nota-chica">¿Es tu primera vez? Escribí tu DNI y, como contraseña, el código de 8 números que te ${ui.tipoIngreso === 'entrenador' ? 'dio la administración del gimnasio' : 'dio tu entrenador'}.</p>
      ${ui.errorIngreso ? `<p class="error">${esc(ui.errorIngreso)}</p>` : ''}
      <button type="submit" class="boton ancho" ${ui.ocupado ? 'disabled' : ''}>${ui.ocupado ? 'Ingresando…' : 'Ingresar'}</button>
    </form>
  </section>`;
}

// Primer ingreso de un alumno o entrenador: crea su propia contraseña
function pantallaCrearClave() {
  return `<section class="ingreso">
    ${logo(false)}
    <p class="ingreso-bajada">Sports Recovery</p>
    <h1>Hola, ${esc(perfil.nombre.split(' ')[0])}</h1>
    <p class="suave">Es tu primer ingreso. Creá tu contraseña: desde ahora la vas a usar junto con tu DNI y el código ya no va a servir.</p>
    <form class="form-ingreso" data-form="crear-clave">
      <label class="campo">Nueva contraseña
        <input name="clave" type="password" required minlength="6" autocomplete="new-password" placeholder="Mínimo 6 caracteres">
      </label>
      <label class="campo">Repetí la contraseña
        <input name="repetir" type="password" required minlength="6" autocomplete="new-password" placeholder="La misma de arriba">
      </label>
      ${ui.errorIngreso ? `<p class="error">${esc(ui.errorIngreso)}</p>` : ''}
      <button type="submit" class="boton ancho" ${ui.ocupado ? 'disabled' : ''}>${ui.ocupado ? 'Guardando…' : 'Crear contraseña y entrar'}</button>
    </form>
    <button class="boton-texto" data-accion="salir">‹ Volver</button>
  </section>`;
}

/* ---------- Selector de fecha con calendario (compartido) ---------- */

// Calendario + botones rápidos. La alumna mira hacia atrás ("Ayer");
// el profesor programa hacia adelante ("Mañana").
function selectorFecha(cambio, fecha, etiqueta, haciaAdelante = false) {
  const rapidos = [['Hoy', 0], haciaAdelante ? ['Mañana', 1] : ['Ayer', -1]].map(([texto, dias]) => {
    const valor = fechaISO(new Date(Date.now() + dias * 864e5));
    return `<button class="chip ${fecha === valor ? 'activa' : ''}" data-accion="${cambio}" data-valor="${valor}">${texto}</button>`;
  }).join('');
  return `<div class="selector-fecha">
    <label class="campo">${etiqueta}
      <input type="date" value="${fecha}" data-cambio="${cambio}">
    </label>
    <div class="fila-botones">${rapidos}</div>
  </div>`;
}

/* ---------- Selector de días de la semana (rutina semanal) ---------- */

function selectorDias(alumnaId) {
  const hoy = new Date().getDay();
  // Lunes a domingo
  const orden = [1, 2, 3, 4, 5, 6, 0];
  return `<div class="chips dias">${orden.map(d => {
    const tiene = (datos.rutinas[alumnaId]?.[d] || []).length > 0;
    return `<button class="chip ${ui.dia === d ? 'activa' : ''} ${tiene ? 'con-rutina' : ''}" data-accion="dia" data-valor="${d}">
      ${DIAS_CORTOS[d]}${d === hoy ? '<i class="punto-hoy"></i>' : ''}</button>`;
  }).join('')}</div>`;
}

/* ---------- Alumna ---------- */

function pantallaAlumna() {
  if (ui.pestana === 'progreso') return alumnaProgreso();
  if (ui.pestana === 'encuesta') return encuesta('gimnasio');
  return alumnaHoy();
}

function alumnaHoy() {
  const alumna = alumnaPorId(perfil.alumnaId);
  const fecha = ui.fecha;
  const rutina = rutinaDeFecha(alumna.id, fecha);
  const hoy = fechaISO();
  const esHoy = fecha === hoy;
  const esFutura = fecha > hoy;
  const especial = !!cambiosDe(alumna.id)[fecha];
  const sePuedeRegistrar = !esFutura;
  const titulo = portadaDelDia(alumna, fecha, rutina) + selectorFecha('fecha-alumna', fecha, 'Elegí el día que querés ver o anotar');

  // Cambiando su propia rutina
  if (ui.editando) {
    return titulo + `<div class="aviso-especial fila-separada">
        <span>Estás cambiando ${ui.modoRutina === 'fecha' ? 'solo el ' + fechaLarga(fecha) : 'todos los ' + diaEnPlural(diaDeSemana(fecha))}.</span>
        <button class="boton" data-accion="terminar-edicion">Listo</button>
      </div>` + editorRutina(alumna);
  }
  // Eligiendo si cambia solo ese día o todas las semanas
  if (ui.eligiendoAlcance) {
    return titulo + `<div class="tarjeta">
        <h3>¿Qué querés cambiar?</h3>
        <div class="alcance">
          <button class="boton" data-accion="editar-mi-rutina" data-valor="fecha">Solo el ${fechaLarga(fecha)}</button>
          <button class="boton secundario" data-accion="editar-mi-rutina" data-valor="semanal">Todos los ${diaEnPlural(diaDeSemana(fecha))}</button>
          <button class="boton-texto" data-accion="cancelar-edicion">Cancelar</button>
        </div>
      </div>`;
  }

  const tarjetas = rutina.map((ej, i) => {
    const hecho = registroDe(alumna.id, ej.nombre, fecha);
    const abierto = ui.registrando === i;
    const base = hecho || ej; // si ya registró, se muestra lo que hizo
    return `<article class="tarjeta ejercicio ${hecho ? 'hecho' : ''} ${ui.recien === ej.nombre + '|' + fecha ? 'recien' : ''}">
      <div class="ejercicio-titulo">
        <div><small class="musculo">${iconoMusculo(ej.musculo)} ${esc(ej.musculo)}</small><h3>${esc(ej.nombre)}</h3>${notaDe(ej)}</div>
        ${hecho ? '<span class="check">✓</span>' : ''}
      </div>
      <div class="datos-ejercicio">
        <div><b>${ej.series}</b><small>series</small></div>
        <div><b>${esc(repsDe(ej))}</b><small>reps</small></div>
        <div><b>${formatoPeso(ej.peso)}</b><small>peso</small></div>
        <div><b>${formatoPausa(ej.pausa)}</b><small>pausa</small></div>
      </div>
      ${!sePuedeRegistrar ? '' : abierto ? `
        <form class="registro" data-form="registro" data-indice="${i}">
          <p class="registro-titulo">¿Qué hiciste ${esHoy ? 'hoy' : 'el ' + fechaLarga(fecha)}?</p>
          <div class="grilla-2">
            <label>Series<input type="number" name="series" step="1" min="1" inputmode="numeric" value="${base.series}"></label>
            <label>Repeticiones<input type="number" name="reps" step="1" min="0" inputmode="numeric" value="${base.reps}"></label>
            <label>Peso (kg)<input type="number" name="peso" step="0.5" min="0" inputmode="decimal" value="${base.peso}"></label>
            <label>Pausa (segundos)<input type="number" name="pausa" step="5" min="0" inputmode="numeric" value="${base.pausa}"></label>
          </div>
          <div class="fila-botones">
            <button type="button" class="boton secundario" data-accion="cancelar-registro">Cancelar</button>
            <button type="submit" class="boton">Guardar</button>
          </div>
        </form>`
      : hecho ? `
        <div class="hecho-resumen">
          <span><b>Hiciste:</b> ${hecho.series} × ${hecho.reps} · ${formatoPeso(hecho.peso)} · pausa ${formatoPausa(hecho.pausa)}</span>
          <button class="boton-texto" data-accion="registrar" data-valor="${i}">Cambiar</button>
        </div>`
      : `<button class="boton ancho" data-accion="registrar" data-valor="${i}">Registrar lo que hice</button>`}
    </article>`;
  }).join('');

  return titulo + `
    ${especial ? '<p class="aviso-especial">Rutina especial para este día.</p>' : ''}
    ${tarjetas}
    ${esFutura && rutina.length ? '<p class="suave centro">Este día todavía no llegó: vas a poder anotar lo que hiciste cuando llegue.</p>' : ''}
    ${!esFutura ? tarjetaDiario(alumna, fecha) : ''}
    <button class="boton secundario ancho" data-accion="cambiar-mi-rutina">${rutina.length ? 'Cambiar mi rutina de este día' : 'Armar mi rutina para este día'}</button>`;
}

// Arriba de la rutina: saludo, qué le toca, cuánto dura y cuánto lleva hecho
function portadaDelDia(alumna, fecha, rutina) {
  const hoy = fechaISO();
  const nombre = esc(perfil.nombre.split(' ')[0]);
  const cuando = fecha === hoy ? 'Hoy te toca' : fecha > hoy ? `El ${fechaLarga(fecha)} te toca` : `El ${fechaLarga(fecha)} te tocaba`;
  if (!rutina.length) {
    return `<div class="tarjeta portada-dia">
        <p class="portada-saludo">${saludoPorHora()}, ${nombre}! 👋</p>
        <h1>${fecha === hoy ? 'Hoy: recuperación' : 'Sin rutina'}</h1>
        <p class="portada-datos">${fecha === hoy ? 'Hoy no tenés rutina. Descansar también es parte del protocolo: mañana seguimos 😌' : `El ${fechaLarga(fecha)} no tiene rutina.`}</p>
      </div>`;
  }
  const musculos = [...new Set(rutina.map(e => e.musculo).filter(Boolean))];
  const hechos = rutina.filter(ej => registroDe(alumna.id, ej.nombre, fecha)).length;
  const completo = hechos === rutina.length;
  return `<div class="tarjeta portada-dia ${completo ? 'completa' : ''}">
      <p class="portada-saludo">${saludoPorHora()}, ${nombre}! 👋</p>
      <h1>${cuando}</h1>
      <div class="portada-musculos">${musculos.map(m => `<span class="chip-musculo">${iconoMusculo(m)} ${esc(m)}</span>`).join('')}</div>
      <p class="portada-datos">${rutina.length} ${rutina.length === 1 ? 'ejercicio' : 'ejercicios'} · unos ${duracionAproximada(rutina)} minutos · ${esc(alumna.disciplina)}</p>
      ${fecha <= hoy ? `<div class="progreso-dia">
          <span class="barra"><i style="width:${Math.round(hechos / rutina.length * 100)}%"></i></span>
          <small>${completo ? '🎉 ¡Rutina completa!' : `${hechos} de ${rutina.length} hechos`}</small>
        </div>` : ''}
    </div>
    <p class="frase-dia">“${fraseDelDia(fecha)}”</p>`;
}

// Abajo de la rutina: cómo se sintió (carita) y un comentario para su entrenador
function tarjetaDiario(alumna, fecha) {
  const guardado = datos.diario[alumna.id]?.[fecha];
  if (guardado && !ui.editandoDiario) {
    const [, carita, texto] = sensacionDe(guardado.sensacion);
    return `<div class="tarjeta diario guardado">
        <div class="fila-separada"><h3>¿Cómo te sentiste?</h3><button class="boton-texto" data-accion="editar-diario">Cambiar</button></div>
        <p class="diario-resumen"><span class="carita-grande">${carita}</span> <b>${texto}</b></p>
        ${guardado.comentario ? `<p class="suave">“${esc(guardado.comentario)}”</p>` : ''}
        <p class="nota-chica">Tu entrenador ya lo puede ver.</p>
      </div>`;
  }
  const elegida = ui.sensacion || guardado?.sensacion || null;
  return `<form class="tarjeta diario" data-form="diario">
      <h3>¿Cómo te sentiste?</h3>
      <div class="caritas">${SENSACIONES.map(([clave, carita, texto]) => `
        <button type="button" class="carita ${elegida === clave ? 'elegida' : ''}" data-accion="sensacion" data-valor="${clave}">
          <span>${carita}</span><small>${texto}</small></button>`).join('')}
      </div>
      <label class="campo">Comentario para tu entrenador (opcional)
        <textarea name="comentario-dia" rows="2" maxlength="300" placeholder="Ej.: Me molestó la rodilla en la prensa">${esc(ui.comentarioDia || guardado?.comentario || '')}</textarea>
      </label>
      <button type="submit" class="boton ancho" ${elegida ? '' : 'disabled'}>Guardar</button>
    </form>`;
}

// El mismo progreso lo ven el alumno (vista 'alumno') y su entrenador (vista 'profe')
function alumnaProgreso(alumnaId = perfil.alumnaId, vista = 'alumno') {
  const est = estadisticasDe(alumnaId);
  const paraProfe = vista === 'profe';
  const t = (alAlumno, alProfe) => paraProfe ? alProfe : alAlumno;
  const nombre = esc((paraProfe ? alumnaPorId(alumnaId).nombre : perfil.nombre).split(' ')[0]);
  const nota = datos.notasProgreso[alumnaId];
  const mensajeProfe = nota ? `<div class="tarjeta nota-profe"><h3>Mensaje de tu profe</h3><p>${esc(nota)}</p></div>` : '';

  if (!est.ejercicios.length) {
    if (paraProfe) return `<div class="tarjeta vacio">${nombre} todavía no registró ejercicios.</div>`;
    return `<div class="tarjeta saludo"><h1>¡Hola, ${nombre}!</h1>
        <p>Tu progreso arranca con el primer registro. Anotá lo que hagas hoy en <b>Rutina</b> y desde acá vas a ver, con números, cuánto avanzás semana a semana.</p></div>
      ${mensajeProfe}${evaluacionDeAlumna(alumnaId)}`;
  }

  const nombres = est.ejercicios.map(e => e.nombre);
  if (!nombres.includes(ui.ejercicioGrafico)) ui.ejercicioGrafico = (est.ejercicios.find(e => e.conPeso) || est.ejercicios[0]).nombre;
  const elegido = est.ejercicios.find(e => e.nombre === ui.ejercicioGrafico);
  const mejorReps = Math.max(...elegido.lista.map(r => r.reps));
  const mejorPeso = Math.max(...elegido.lista.map(r => r.peso));
  const aumento = elegido.ultimo.peso - elegido.primero.peso;
  const conPorcentaje = est.ejercicios.filter(e => e.pct !== null).sort((a, b) => b.pct - a.pct);
  const maxBarra = Math.max(10, ...conPorcentaje.map(e => Math.abs(e.pct)));

  const contador = (n, antes = '', despues = '') => `<span data-contar="${n}" data-antes="${antes}" data-despues="${despues}">${antes}${numero(n)}${despues}</span>`;
  return `${paraProfe ? '' : `<div class="tarjeta saludo">
      <h1>${tituloSaludo(est, nombre)}</h1>
      ${mensajesSaludo(est).map(m => `<p>${m}</p>`).join('')}
    </div>`}

    <div class="resumen">
      <div class="tarjeta"><b>🔥 ${contador(est.racha)}</b><small>${est.racha === 1 ? 'semana seguida' : 'semanas seguidas'}</small></div>
      <div class="tarjeta"><b>📅 ${contador(est.esteMes)}</b><small>${est.esteMes === 1 ? 'entrenamiento' : 'entrenamientos'} este mes</small></div>
      <div class="tarjeta"><b>🏆 ${contador(est.records.length)}</b><small>${est.records.length === 1 ? 'récord' : 'récords'}</small></div>
    </div>

    ${est.promedio !== null ? `<div class="tarjeta mejora-general">
        <small>${t('Tu mejora promedio desde que empezaste', 'Mejora promedio desde que empezó')}</small>
        <b class="${est.promedio > 0 ? 'oro' : ''}">${contador(est.promedio, est.promedio > 0 ? '+' : '', ' %')}</b>
        ${paraProfe ? '' : `<p>${est.promedio > 0 ? `Sumando todos tus ejercicios, hoy movés en promedio un ${est.promedio} % más que el primer día.` : 'Por ahora estás sosteniendo tus marcas iniciales. Sostener también es parte del proceso.'}</p>`}
      </div>` : ''}

    ${conPorcentaje.length ? `<h2>${t('Cuánto mejoraste en cada ejercicio', 'Cuánto mejoró en cada ejercicio')}</h2>
      <div class="tarjeta">${conPorcentaje.map(e => `
        <button class="barra-ejercicio ${e.nombre === ui.ejercicioGrafico ? 'activa' : ''}" data-accion="ver-ejercicio" data-valor="${esc(e.nombre)}">
          <span class="fila-separada"><span>${esc(e.nombre)}${e.record ? ' 🏆' : ''}</span>
            <b class="${e.pct > 0 ? 'oro' : ''}">${e.pct > 0 ? '+' : ''}${e.pct} %</b></span>
          <span class="barra"><i class="${e.pct < 0 ? 'baja' : ''}" style="width:${Math.max(3, Math.abs(e.pct) / maxBarra * 100)}%"></i></span>
          <small>${valorConUnidad(e, e.primero)} → ${valorConUnidad(e, e.ultimo)}</small>
        </button>`).join('')}
      </div>` : ''}

    <h2>Detalle por ejercicio</h2>
    <label class="campo">Ejercicio
      <select data-cambio="ejercicio-grafico">
        ${nombres.map(n => `<option ${n === ui.ejercicioGrafico ? 'selected' : ''}>${esc(n)}</option>`).join('')}
      </select>
    </label>
    <div class="resumen">
      <div class="tarjeta"><b>${formatoPeso(mejorPeso)}</b><small>Mejor peso</small></div>
      <div class="tarjeta"><b>${mejorReps}</b><small>Máx. repeticiones</small></div>
      <div class="tarjeta"><b class="${aumento > 0 ? 'oro' : ''}">${aumento > 0 ? '+' : ''}${numero(aumento)} kg</b>
        <small>${elegido.pct !== null && elegido.conPeso ? `${elegido.pct > 0 ? '+' : ''}${elegido.pct} % desde el inicio` : 'Aumento desde el inicio'}</small></div>
    </div>
    <div class="tarjeta">
      <h3>Peso (kg)</h3>
      ${grafico(elegido.lista.map(r => ({ fecha: r.fecha, valor: r.peso })), 'var(--azul)')}
      ${elegido.conPeso && elegido.lista.length > 1 ? '<p class="nota-chica">El punto dorado es tu mejor marca.</p>' : ''}
    </div>
    ${paraProfe ? '' : `<div class="tarjeta significado">
      <h3>Qué significa tu progreso</h3>
      <p>${significadoProgreso(elegido.lista, mejorPeso, mejorReps)}</p>
    </div>`}

    ${est.records.length ? `<h2>${t('Tus récords', 'Sus récords')} 🏆</h2>
      <div class="tarjeta">${est.records.map(e => `<div class="fila-separada fila-test">
          <span>${esc(e.nombre)}</span><b>${valorConUnidad(e, e.record)} <small class="suave">· ${formatoFecha(e.record.fecha)}</small></b>
        </div>`).join('')}
        ${paraProfe ? '' : '<p class="nota-chica">Cada récord es una marca que antes no podías hacer.</p>'}
      </div>` : ''}

    ${paraProfe ? '' : comparacionConEvaluacion(alumnaId, est) + mensajeProfe + evaluacionDeAlumna(alumnaId)}`;
}

// Números del progreso de un alumno: mejoras por ejercicio, récords y constancia
function estadisticasDe(alumnaId) {
  const registros = datos.registros.filter(r => r.alumnaId === alumnaId);
  const porEjercicio = {};
  registros.forEach(r => (porEjercicio[r.nombre] ||= []).push(r));

  const ejercicios = Object.entries(porEjercicio).map(([nombre, lista]) => {
    lista.sort((a, b) => a.fecha.localeCompare(b.fecha));
    const conPeso = lista.some(r => r.peso > 0);
    const valor = r => conPeso ? r.peso : r.reps; // sin peso, se mide por repeticiones
    const primero = lista[0], ultimo = lista[lista.length - 1];
    const pct = lista.length > 1 && valor(primero) > 0 ? Math.round((valor(ultimo) - valor(primero)) / valor(primero) * 100) : null;
    // Récord: la mejor marca, si superó a todas las anteriores
    const mejor = Math.max(...lista.map(valor));
    const i = lista.findIndex(r => valor(r) === mejor);
    const record = i > 0 && mejor > Math.max(...lista.slice(0, i).map(valor)) ? lista[i] : null;
    return { nombre, lista, conPeso, primero, ultimo, pct, record };
  });

  const fechas = [...new Set(registros.map(r => r.fecha))];
  const mes = fechaISO().slice(0, 7);
  const mesPasado = sumarDias(mes + '-01', -1).slice(0, 7);
  const semanas = new Set(fechas.map(lunesDe));
  // Semanas seguidas con al menos un entrenamiento (la semana actual cuenta si ya entrenó)
  let racha = 0, semana = lunesDe(fechaISO());
  if (!semanas.has(semana)) semana = sumarDias(semana, -7);
  while (semanas.has(semana)) { racha++; semana = sumarDias(semana, -7); }
  const medibles = ejercicios.filter(e => e.pct !== null);

  return {
    ejercicios, racha,
    esteMes: fechas.filter(f => f.startsWith(mes)).length,
    mesAnterior: fechas.filter(f => f.startsWith(mesPasado)).length,
    promedio: medibles.length ? Math.round(medibles.reduce((suma, e) => suma + e.pct, 0) / medibles.length) : null,
    records: ejercicios.filter(e => e.record)
  };
}

function valorConUnidad(ejercicio, registro) {
  return ejercicio.conPeso ? formatoPeso(registro.peso) : `${registro.reps} reps`;
}

function tituloSaludo(est, nombre) {
  if (est.promedio >= 10) return `¡Vas muy bien, ${nombre}!`;
  if (est.promedio > 0) return `¡Vas por buen camino, ${nombre}!`;
  if (est.esteMes > 0) return `¡Bien ahí, ${nombre}!`;
  return `¡Hola, ${nombre}!`;
}

// Frases cálidas pero reales: siempre con los números del alumno
function mensajesSaludo(est) {
  const mensajes = [];
  const veces = n => n === 1 ? '1 vez' : `${n} veces`;
  if (est.esteMes > est.mesAnterior && est.mesAnterior > 0) mensajes.push(`Este mes entrenaste ${veces(est.esteMes)}: ${est.esteMes - est.mesAnterior} más que el mes pasado. Eso es constancia.`);
  else if (est.esteMes > 0) mensajes.push(`Este mes ya entrenaste ${veces(est.esteMes)}. Cada entrenamiento suma.`);
  else mensajes.push('Este mes todavía no registraste entrenamientos. El mejor momento para retomar es hoy: tu progreso te espera donde lo dejaste.');
  if (est.racha >= 2) mensajes.push(`Llevás <b>${est.racha} semanas seguidas</b> sin aflojar. Así se construyen los resultados.`);
  const mejor = est.ejercicios.filter(e => e.pct > 0).sort((a, b) => b.pct - a.pct)[0];
  if (mejor) mensajes.push(`Tu mayor avance es en <b>${esc(mejor.nombre)}</b>: un ${mejor.pct} % más que cuando empezaste.`);
  return mensajes;
}

// Compara con la evaluación inicial (tests de peso máximo) usando lo que registró después
function comparacionConEvaluacion(alumnaId, est) {
  const tests = testsDe(alumnaId).filter(t => t.unidad === 'kg' && t.resultado > 0);
  const filas = tests.map(t => {
    const clave = t.nombre.split(':')[0].trim().toLowerCase();
    const ejercicio = est.ejercicios.find(e => e.conPeso && e.nombre.toLowerCase().includes(clave));
    if (!ejercicio) return '';
    // Máximo estimado (fórmula de Epley): peso × (1 + repeticiones / 30)
    const hoy = Math.max(...ejercicio.lista.map(r => r.peso * (1 + r.reps / 30)));
    const pct = Math.round((hoy - t.resultado) / t.resultado * 100);
    return `<p>Cuando empezaste, tu máximo en <b>${esc(clave)}</b> era de ${formatoPeso(t.resultado)}. ${pct > 0
      ? `Por lo que registrás, hoy tu máximo estimado ronda los <b>${formatoPeso(Math.round(hoy * 2) / 2)}</b>: un <b class="oro">${pct} % más</b>.`
      : `Hoy estás cerca de esa marca. Seguí sumando semanas: la fuerza se construye de a poco.`}</p>`;
  }).filter(Boolean);
  return filas.length ? `<div class="tarjeta"><h3>Desde tu evaluación inicial</h3>${filas.join('')}</div>` : '';
}
function testsDe(alumnaId) { return datos.evaluaciones[alumnaId]?.tests || []; }

// La alumna ve su evaluación inicial, sin poder cambiarla
function evaluacionDeAlumna(alumnaId) {
  const ev = datos.evaluaciones[alumnaId];
  if (!ev) return '';
  const dato = (titulo, valor) => valor ? `<div><small>${titulo}</small><b>${esc(valor)}</b></div>` : '';
  return `<h2>Mi evaluación inicial</h2>
    <div class="tarjeta">
      <p class="suave">Hecha el ${esc(formatoFecha(ev.fecha))}</p>
      <div class="datos-evaluacion">
        ${dato('Objetivo', ev.objetivo)}${dato('Nivel', ev.nivel)}
        ${dato('Peso', ev.pesoCorporal ? numero(ev.pesoCorporal) + ' kg' : '')}${dato('Altura', ev.altura ? ev.altura + ' cm' : '')}
      </div>
      ${(ev.tests || []).map(t => `<div class="fila-separada fila-test"><span>${esc(t.nombre)}</span><b>${numero(t.resultado)} ${esc(t.unidad)}</b></div>`).join('')}
      ${ev.observaciones ? `<p class="evaluacion-obs"><b>Observaciones:</b> ${esc(ev.observaciones)}</p>` : ''}
    </div>`;
}

// Explica el progreso en palabras simples, con los números reales y con calidez
function significadoProgreso(puntos, mejorPeso, mejorReps) {
  const nombre = esc(ui.ejercicioGrafico);
  const primero = puntos[0], ultimo = puntos[puntos.length - 1];
  if (puntos.length < 2) return `Ya tenés tu primer registro de ${nombre}. Con el próximo vas a empezar a ver cuánto avanzás.`;
  if (mejorPeso === 0) {
    const masReps = ultimo.reps - primero.reps;
    return masReps > 0
      ? `${nombre} se hace sin peso, y pasaste de ${primero.reps} a ${ultimo.reps} repeticiones. Más repeticiones es más resistencia: muy bien.`
      : `${nombre} se hace sin peso. Tu mejor marca es de ${mejorReps} repeticiones en una serie: el próximo objetivo es superarla.`;
  }
  const dias = (new Date(ultimo.fecha) - new Date(primero.fecha)) / 864e5;
  const semanas = Math.max(1, Math.round(dias / 7));
  const tiempo = semanas === 1 ? '1 semana' : `${semanas} semanas`;
  const diferencia = ultimo.peso - primero.peso;
  if (diferencia > 0) {
    const pct = primero.peso > 0 ? Math.round(diferencia / primero.peso * 100) : 0;
    return `En ${tiempo} pasaste de ${formatoPeso(primero.peso)} a ${formatoPeso(ultimo.peso)} en ${nombre}: son ${numero(diferencia)} kg más${pct ? `, un ${pct} % más de carga` : ''}. ${pct >= 20
      ? 'Es un avance enorme, y es mérito tuyo: se nota el trabajo de cada semana.'
      : 'Cada kilo que sumás es fuerza que antes no tenías. Seguí así.'}`;
  }
  if (diferencia === 0) return `Hace ${tiempo} que sostenés ${formatoPeso(ultimo.peso)} en ${nombre}. Sostener también es progreso: cuando completes todas las repeticiones con buena técnica, hablalo con tu profe para subir.`;
  return `Hoy usás ${numero(-diferencia)} kg menos que al inicio en ${nombre}. Bajar la carga a veces es parte del protocolo (técnica, recuperación o cansancio). Lo importante es que seguís entrenando: consultalo con tu profe.`;
}

// Dibuja un gráfico de línea simple con SVG (sin librerías externas)
function grafico(puntos, color) {
  if (puntos.length < 2) return '<p class="suave">Necesitás al menos 2 registros para ver el gráfico.</p>';
  if (puntos.every(p => p.valor === 0)) return '<p class="suave">Este ejercicio se hace sin peso.</p>';
  const W = 320, H = 170, iz = 34, de = 12, ar = 14, ab = 26;
  const valores = puntos.map(p => p.valor);
  let min = Math.min(...valores), max = Math.max(...valores);
  if (min === max) { min -= 1; max += 1; }
  const x = i => iz + i * (W - iz - de) / (puntos.length - 1);
  const y = v => ar + (max - v) * (H - ar - ab) / (max - min);
  const linea = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');
  const area = `${linea} L${x(puntos.length - 1).toFixed(1)},${H - ab} L${iz},${H - ab} Z`;
  const guias = [max, (max + min) / 2, min].map(v => `<line x1="${iz}" x2="${W - de}" y1="${y(v)}" y2="${y(v)}" class="guia"/>
      <text x="${iz - 6}" y="${y(v) + 4}" text-anchor="end">${numero(v)}</text>`).join('');
  const etiquetas = puntos.map((p, i) => (i === 0 || i === puntos.length - 1 || puntos.length <= 5)
    ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${formatoFecha(p.fecha)}</text>` : '').join('');
  const mejor = Math.max(...valores);
  const circulos = puntos.map((p, i) => p.valor === mejor && i === valores.indexOf(mejor)
    ? `<circle cx="${x(i)}" cy="${y(p.valor)}" r="6" fill="var(--oro)"><title>Mejor marca · ${formatoFecha(p.fecha)}: ${numero(p.valor)} kg</title></circle>`
    : `<circle cx="${x(i)}" cy="${y(p.valor)}" r="3.5" fill="${color}"><title>${formatoFecha(p.fecha)}: ${numero(p.valor)} kg</title></circle>`).join('');
  return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de peso">
    ${guias}
    <path d="${area}" fill="${color}" opacity="0.12"/>
    <path d="${linea}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${circulos}${etiquetas}
  </svg>`;
}

/* ---------- Encuesta (compartida) ---------- */

function encuesta(area) {
  const mias = datos.encuestas.filter(e => e.area === area && e.autor === perfil.nombre);
  return `<h1>Encuesta de satisfacción</h1>
    <p class="suave">¿Qué tan conforme estás con el ${area === 'gimnasio' ? 'gimnasio' : 'consultorio'}?</p>
    <form class="tarjeta" data-form="encuesta" data-area="${area}">
      <div class="estrellas">${[1, 2, 3, 4, 5].map(n =>
        `<button type="button" class="${n <= ui.estrellas ? 'llena' : ''}" data-accion="estrella" data-valor="${n}" aria-label="${n} estrellas">★</button>`).join('')}
      </div>
      <label class="campo">Comentario (opcional)
        <textarea name="comentario" rows="3" maxlength="300" placeholder="Contanos qué te gustó o qué mejorarías">${esc(ui.comentario)}</textarea>
      </label>
      <button type="submit" class="boton ancho" ${ui.estrellas ? '' : 'disabled'}>Enviar</button>
    </form>
    ${mias.length ? `<h2>Mis respuestas</h2>${mias.slice().reverse().map(tarjetaEncuesta).join('')}` : ''}`;
}

function tarjetaEncuesta(e) {
  return `<div class="tarjeta respuesta">
    <div class="fila-separada"><strong>${esc(e.autor)}</strong><span class="oro">${'★'.repeat(e.puntaje)}${'☆'.repeat(5 - e.puntaje)}</span></div>
    ${e.comentario ? `<p>${esc(e.comentario)}</p>` : ''}
    <small class="suave">${formatoFecha(e.fecha)}</small>
  </div>`;
}

/* ---------- Profesor ---------- */

function pantallaProfesor() {
  if (ui.pestana === 'entrenadores' && perfil.esAdmin) return ui.entrenadorId ? fichaEntrenador() : listaEntrenadores();
  if (ui.pestana === 'encuestas') return profesorEncuestas();
  if (ui.pestana === 'kinesio') return proximamente('Kinesiología', 'Acá vas a agregar turnos y registrar cada sesión: evaluación, protocolo y resultado.');
  return ui.alumnaId ? profesorFichaAlumna() : profesorAlumnas();
}

function profesorAlumnas() {
  const filtros = ['Todos', ...DISCIPLINAS, ...DISCIPLINAS_PROXIMAMENTE];
  const chips = `<div class="chips">${filtros.map(d =>
    `<button class="chip ${ui.filtro === d ? 'activa' : ''}" data-accion="filtro" data-valor="${d}">${d}</button>`).join('')}
  </div>`;
  const encabezadoLista = `<h1>Gimnasio</h1><p class="suave">Paso 1: elegí el alumno para armar su rutina.</p>${chips}`;

  if (DISCIPLINAS_PROXIMAMENTE.includes(ui.filtro)) {
    return encabezadoLista + `<div class="tarjeta vacio"><span class="etiqueta-oro">Próximamente</span><p>${ui.filtro} se suma en una próxima versión de la app.</p></div>`;
  }

  const lista = datos.alumnas.filter(a => ui.filtro === 'Todos' || a.disciplina === ui.filtro);
  return encabezadoLista + `
    ${lista.map(a => {
      const dias = Object.keys(datos.rutinas[a.id] || {}).filter(d => datos.rutinas[a.id][d].length).length;
      return `<button class="tarjeta fila-alumna" data-accion="elegir-alumna" data-valor="${a.id}">
        <span class="perfil-inicial">${esc(a.nombre[0])}</span>
        <span class="crece"><strong>${esc(a.nombre)}</strong><small>${esc(a.disciplina)} · ${dias} ${dias === 1 ? 'día' : 'días'} con rutina${perfil.esAdmin ? ` · ${a.entrenadorUid ? 'Entrenador: ' + esc(a.entrenadorNombre) : 'Tuyo'}` : ''}</small>
          ${a.debeCambiarClave ? '<em class="etiqueta-propio">Falta su primer ingreso</em>' : ''}</span>
        <span class="flecha">›</span>
      </button>`;
    }).join('') || (datos.alumnas.length ? '<div class="tarjeta vacio">No hay alumnos en esta disciplina.</div>'
      : `<div class="tarjeta vacio"><p>Todavía no cargaste alumnos. Tocá "+ Nuevo alumno" para crear el primero.</p>
          ${perfil.esAdmin ? `<button class="boton secundario" data-accion="cargar-ejemplo" ${ui.ocupado ? 'disabled' : ''}>${ui.ocupado ? 'Cargando…' : 'Cargar 3 alumnos de ejemplo para probar'}</button>` : ''}</div>`)}
    ${ui.nuevaAlumna ? `
      <form class="tarjeta" data-form="nueva-alumna">
        <h3>Nuevo alumno</h3>
        <label class="campo">Nombre y apellido<input name="nombre" required maxlength="40" placeholder="Ej.: Ana Torres"></label>
        <label class="campo">DNI (sin puntos) — es su usuario para ingresar
          <input name="dni" required inputmode="numeric" pattern="[0-9]{7,8}" maxlength="8" placeholder="Ej.: 35123456"></label>
        <p class="nota-chica">La app genera un código de primer ingreso. Entra con su DNI y ese código, y crea su propia contraseña.</p>
        <label class="campo">Disciplina
          <select name="disciplina">${DISCIPLINAS.map(d => `<option>${d}</option>`).join('')}</select>
        </label>
        ${ui.errorAlumna ? `<p class="error">${esc(ui.errorAlumna)}</p>` : ''}
        <div class="fila-botones">
          <button type="button" class="boton secundario" data-accion="cerrar-nueva-alumna">Cancelar</button>
          <button type="submit" class="boton" ${ui.ocupado ? 'disabled' : ''}>${ui.ocupado ? 'Creando…' : 'Agregar'}</button>
        </div>
      </form>`
    : '<button class="boton secundario ancho" data-accion="abrir-nueva-alumna">+ Nuevo alumno</button>'}`;
}

/* ---------- Entrenadores (solo la administradora) ---------- */

function listaEntrenadores() {
  return `<h1>Entrenadores</h1>
    <p class="suave">Cada entrenador ve y maneja solo sus alumnos. Vos ves a todos.</p>
    ${datos.entrenadores.map(e => {
      const cantidad = datos.alumnas.filter(a => a.entrenadorUid === e.uid).length;
      return `<button class="tarjeta fila-alumna" data-accion="elegir-entrenador" data-valor="${esc(e.uid)}">
        <span class="perfil-inicial">${esc(e.nombre[0])}</span>
        <span class="crece"><strong>${esc(e.nombre)}</strong><small>DNI ${esc(e.dni)} · ${cantidad} ${cantidad === 1 ? 'alumno' : 'alumnos'}</small>
          ${e.debeCambiarClave ? '<em class="etiqueta-propio">Falta su primer ingreso</em>' : ''}</span>
        <span class="flecha">›</span>
      </button>`;
    }).join('') || '<div class="tarjeta vacio">Todavía no hay entrenadores. Creá el primero con el botón de abajo.</div>'}
    ${ui.nuevoEntrenador ? `
      <form class="tarjeta" data-form="nuevo-entrenador">
        <h3>Nuevo entrenador</h3>
        <label class="campo">Nombre y apellido<input name="nombre" required maxlength="40" placeholder="Ej.: Juan Pérez"></label>
        <label class="campo">DNI (sin puntos) — es su usuario para ingresar
          <input name="dni" required inputmode="numeric" pattern="[0-9]{7,8}" maxlength="8" placeholder="Ej.: 28123456"></label>
        <p class="nota-chica">La app genera un código de primer ingreso. Entra eligiendo "Soy entrenador", con su DNI y ese código, y crea su propia contraseña.</p>
        ${ui.errorEntrenador ? `<p class="error">${esc(ui.errorEntrenador)}</p>` : ''}
        <div class="fila-botones">
          <button type="button" class="boton secundario" data-accion="cerrar-nuevo-entrenador">Cancelar</button>
          <button type="submit" class="boton" ${ui.ocupado ? 'disabled' : ''}>${ui.ocupado ? 'Creando…' : 'Agregar'}</button>
        </div>
      </form>`
    : '<button class="boton secundario ancho" data-accion="abrir-nuevo-entrenador">+ Nuevo entrenador</button>'}`;
}

function fichaEntrenador() {
  const e = datos.entrenadores.find(x => x.uid === ui.entrenadorId);
  if (!e) { ui.entrenadorId = null; return listaEntrenadores(); }
  const suyos = datos.alumnas.filter(a => a.entrenadorUid === e.uid);
  return `<button class="boton-texto volver" data-accion="volver-entrenadores">‹ Entrenadores</button>
    <h1>${esc(e.nombre)}</h1>
    <p class="suave">Entrenador · DNI ${esc(e.dni)}</p>
    ${e.debeCambiarClave ? `
      <div class="tarjeta codigo-ingreso">
        <small>Código de primer ingreso</small>
        <b>${esc(e.codigoInicial)}</b>
        <p>Pasáselo a ${esc(e.nombre.split(' ')[0])}: entra eligiendo "Soy entrenador", con su DNI y este código, y crea su propia contraseña.</p>
      </div>` : ''}
    <div class="cuenta">
      <span>${e.debeCambiarClave ? 'Todavía no creó su contraseña.' : 'Ya creó su contraseña.'}</span>
      <button class="boton-texto" data-accion="restablecer-entrenador" ${ui.ocupado ? 'disabled' : ''}>${e.debeCambiarClave ? 'Generar otro código' : 'Restablecer'}</button>
    </div>
    <h2>Sus alumnos</h2>
    ${suyos.map(a => `<button class="tarjeta fila-alumna" data-accion="ir-alumno" data-valor="${a.id}">
        <span class="perfil-inicial">${esc(a.nombre[0])}</span>
        <span class="crece"><strong>${esc(a.nombre)}</strong><small>${esc(a.disciplina)}</small></span>
        <span class="flecha">›</span>
      </button>`).join('') || '<div class="tarjeta vacio">Todavía no creó alumnos.</div>'}`;
}

// Ficha de una alumna: datos de su cuenta y pestañas Rutina / Evaluación inicial
function profesorFichaAlumna() {
  const alumna = alumnaPorId(ui.alumnaId);
  const secciones = [['rutina', 'Rutina'], ['progreso', 'Progreso'], ['evaluacion', 'Evaluación']];
  return `<button class="boton-texto volver" data-accion="volver">‹ Alumnos</button>
    <h1>${esc(alumna.nombre)}</h1>
    <p class="suave">${esc(alumna.disciplina)} · DNI ${esc(alumna.dni)}${perfil.esAdmin && alumna.entrenadorUid ? ` · Entrenador: ${esc(alumna.entrenadorNombre)}` : ''}</p>
    ${alumna.debeCambiarClave ? `
      <div class="tarjeta codigo-ingreso">
        <small>Código de primer ingreso</small>
        <b>${esc(alumna.codigoInicial)}</b>
        <p>Pasáselo a ${esc(alumna.nombre.split(' ')[0])}: entra con su DNI y este código, y crea su propia contraseña.</p>
      </div>` : ''}
    <div class="cuenta">
      <span>${alumna.debeCambiarClave ? 'Todavía no creó su contraseña.' : 'Ya creó su contraseña.'}</span>
      <button class="boton-texto" data-accion="restablecer-clave" ${ui.ocupado ? 'disabled' : ''}>${alumna.debeCambiarClave ? 'Generar otro código' : 'Restablecer'}</button>
    </div>
    <div class="pestanas-internas">${secciones.map(([id, texto]) =>
      `<button class="${ui.seccionAlumna === id ? 'activa' : ''}" data-accion="seccion-alumna" data-valor="${id}">${texto}</button>`).join('')}
    </div>
    ${ui.seccionAlumna === 'evaluacion' ? profesorEvaluacion(alumna) : ui.seccionAlumna === 'progreso' ? profesorProgreso(alumna) : profesorRutina(alumna)}`;
}

/* ---------- Progreso del alumno visto por el profesor ---------- */

// Los registros de cada alumno se traen recién cuando el profesor abre su progreso
const registrosCargados = new Set();
function cargarRegistrosDe(alumnaId) {
  if (registrosCargados.has(alumnaId) || cargarRegistrosDe.cargando === alumnaId) return;
  cargarRegistrosDe.cargando = alumnaId;
  servidor.cargarRegistrosDe(alumnaId)
    .then(({ registros, diario }) => {
      datos.registros = datos.registros.filter(r => r.alumnaId !== alumnaId).concat(registros);
      datos.diario[alumnaId] = diario;
      registrosCargados.add(alumnaId);
    })
    .catch(mostrarError)
    .finally(() => { cargarRegistrosDe.cargando = null; dibujar.ultima = null; dibujar(); });
}

function profesorProgreso(alumna) {
  if (!registrosCargados.has(alumna.id)) { cargarRegistrosDe(alumna.id); return '<div class="tarjeta vacio">Cargando lo que registró…</div>'; }
  return `<h2>Día por día</h2>
    ${calendarioDelMes(alumna)}
    ${detalleDelDia(alumna, ui.diaProfe)}
    <h2>Sus números</h2>
    ${alumnaProgreso(alumna.id, 'profe')}`;
}

// Calendario del mes: punto azul = entrenó, punto dorado = dejó comentario
function calendarioDelMes(alumna) {
  const [anio, mes] = ui.mes.split('-').map(Number);
  const primero = `${ui.mes}-01`;
  const diasDelMes = new Date(anio, mes, 0).getDate();
  const hueco = (diaDeSemana(primero) + 6) % 7; // empieza en lunes
  const entreno = new Set(datos.registros.filter(r => r.alumnaId === alumna.id).map(r => r.fecha));
  const diario = datos.diario[alumna.id] || {};
  const hoy = fechaISO();
  const nombreMes = `${MESES[mes - 1]} ${anio}`;
  const celdas = [];
  for (let i = 0; i < hueco; i++) celdas.push('<span></span>');
  for (let d = 1; d <= diasDelMes; d++) {
    const fecha = `${ui.mes}-${String(d).padStart(2, '0')}`;
    celdas.push(`<button class="dia-cal ${fecha === ui.diaProfe ? 'elegido' : ''} ${fecha === hoy ? 'hoy' : ''}" data-accion="dia-profe" data-valor="${fecha}">
        ${d}<i>${entreno.has(fecha) ? '<b class="punto-azul"></b>' : ''}${diario[fecha] ? '<b class="punto-oro"></b>' : ''}</i></button>`);
  }
  return `<div class="tarjeta calendario">
      <div class="fila-separada">
        <button class="boton-icono" data-accion="mes" data-valor="-1" aria-label="Mes anterior">‹</button>
        <b class="mes-titulo">${nombreMes}</b>
        <button class="boton-icono" data-accion="mes" data-valor="1" aria-label="Mes siguiente">›</button>
      </div>
      <div class="grilla-cal">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<small>${d}</small>`).join('')}${celdas.join('')}</div>
      <p class="nota-chica"><b class="punto-azul"></b> entrenó · <b class="punto-oro"></b> dejó un comentario</p>
    </div>`;
}

// Qué le tocaba ese día, qué hizo y cómo se sintió
function detalleDelDia(alumna, fecha) {
  const plan = rutinaDeFecha(alumna.id, fecha);
  const hechos = datos.registros.filter(r => r.alumnaId === alumna.id && r.fecha === fecha);
  const diario = datos.diario[alumna.id]?.[fecha];
  const nombres = new Set(plan.map(e => e.nombre));
  const extra = hechos.filter(r => !nombres.has(r.nombre));
  const cumplidos = plan.filter(e => hechos.some(r => r.nombre === e.nombre)).length;
  const fila = (ej, r) => {
    if (!r) return `<div class="fila-dia-profe falta"><span>✗ ${esc(ej.nombre)}</span><small>No lo registró</small></div>`;
    const mas = ej && ej.peso > 0 && r.peso > ej.peso ? ` <b class="oro">⬆ +${numero(r.peso - ej.peso)} kg</b>` : '';
    return `<div class="fila-dia-profe"><span>✓ ${esc(r.nombre)}${ej ? '' : ' <em class="etiqueta-propio">Fuera de la rutina</em>'}</span>
        <small>${r.series} × ${r.reps} · ${formatoPeso(r.peso)} · pausa ${formatoPausa(r.pausa)}${mas}</small></div>`;
  };
  const sinNada = !hechos.length && !diario;
  return `<div class="tarjeta detalle-dia">
      <h3>${fechaLarga(fecha)}</h3>
      ${plan.length ? `<p class="suave">${fecha > fechaISO() ? `Le toca: ${plan.length} ejercicios.` : `Hizo <b>${cumplidos} de ${plan.length}</b> ejercicios de su rutina.`}</p>` : '<p class="suave">No tenía rutina este día.</p>'}
      ${plan.map(ej => fila(ej, hechos.find(r => r.nombre === ej.nombre))).join('')}
      ${extra.map(r => fila(null, r)).join('')}
      ${diario ? `<div class="diario-profe"><span class="carita-grande">${sensacionDe(diario.sensacion)[1]}</span>
          <span><b>${sensacionDe(diario.sensacion)[2]}</b>${diario.comentario ? `<br>“${esc(diario.comentario)}”` : ''}</span></div>` : ''}
      ${sinNada && fecha <= fechaISO() && plan.length ? '<p class="nota-chica">Este día no registró nada.</p>' : ''}
    </div>`;
}

function profesorRutina(alumna) {
  if (ui.importacion) return vistaImportacion(alumna);
  const modos = [['semanal', 'Rutina semanal'], ['fecha', 'Cambiar una fecha']];
  const elegirModo = `<div class="chips">${modos.map(([id, texto]) =>
    `<button class="chip ${ui.modoRutina === id ? 'activa' : ''}" data-accion="modo-rutina" data-valor="${id}">${texto}</button>`).join('')}</div>`;

  let encabezado;
  if (ui.modoRutina === 'semanal') {
    encabezado = `<p class="suave">Lo que armes se repite todas las semanas.</p>
      ${selectorDias(alumna.id)}
      <h2>Todos los ${DIAS[ui.dia].toLowerCase()}${ui.dia === 6 || ui.dia === 0 ? 's' : ''}</h2>`;
  } else {
    const fecha = ui.fechaRutina;
    const especial = cambiosDe(alumna.id)[fecha];
    encabezado = `<p class="suave">Cambiá la rutina de un solo día sin tocar las demás semanas.</p>
      ${selectorFecha('fecha-rutina', fecha, 'Fecha a cambiar', true)}
      <h2>${fechaLarga(fecha)}</h2>`;
    if (!especial) {
      const semanal = rutinaDe(alumna.id, diaDeSemana(fecha));
      return elegirModo + encabezado + `
        <div class="tarjeta vacio">
          <p>Este día usa la rutina semanal de los ${DIAS[diaDeSemana(fecha)].toLowerCase()} (${semanal.length} ${semanal.length === 1 ? 'ejercicio' : 'ejercicios'}).</p>
          <button class="boton" data-accion="personalizar-fecha">Modificar solo esta fecha</button>
        </div>` + notaProgreso(alumna);
    }
    encabezado += `<div class="aviso-especial fila-separada"><span>Rutina especial solo para este día.</span>
      <button class="boton-texto" data-accion="quitar-cambios">Volver a la semanal</button></div>`;
  }
  return elegirModo + encabezado + editorRutina(alumna) + botonExcel() + notaProgreso(alumna);
}

/* ---------- Subir la rutina desde Excel ---------- */

function botonExcel() {
  return `<label class="boton secundario ancho boton-excel ${ui.ocupado ? 'deshabilitado' : ''}">
      ${ui.ocupado ? 'Leyendo la planilla…' : '📄 Subir rutina desde Excel'}
      <input type="file" accept=".xlsx,.xls" data-cambio="subir-excel" hidden ${ui.ocupado ? 'disabled' : ''}>
    </label>`;
}

// Vista previa de la planilla: el profesor elige cómo cargarla y revisa antes de guardar
function vistaImportacion(alumna) {
  const imp = ui.importacion;
  const semana = imp.semanas[imp.modo === 'mes' ? 0 : imp.semana];
  const usados = imp.dias.slice(0, semana.dias.length);
  const repetidos = usados.some((d, i) => usados.indexOf(d) !== i);
  const opcionesDia = elegido => [1, 2, 3, 4, 5, 6, 0].map(d => `<option value="${d}" ${d === elegido ? 'selected' : ''}>${DIAS[d]}</option>`).join('');
  const fin = sumarDias(imp.inicio, imp.semanas.length * 7 - 1);

  return `<h2>Subir rutina desde Excel</h2>
    <p class="suave">${esc(imp.archivo)} · ${imp.semanas.length} ${imp.semanas.length === 1 ? 'semana' : 'semanas'} · ${semana.dias.length} días. Revisá cómo queda antes de guardar.</p>

    <div class="tarjeta">
      <h3>¿Cómo la cargo?</h3>
      <div class="opciones-carga">
        <button class="opcion ${imp.modo === 'semanal' ? 'elegida' : ''}" data-accion="importar-modo" data-valor="semanal">
          <span>Una semana que se repite</span><small>${imp.modo === 'semanal' ? '✓' : ''}</small></button>
        ${imp.semanas.length > 1 ? `<button class="opcion ${imp.modo === 'mes' ? 'elegida' : ''}" data-accion="importar-modo" data-valor="mes">
          <span>Las ${imp.semanas.length} semanas, cada una en su fecha</span><small>${imp.modo === 'mes' ? '✓' : ''}</small></button>` : ''}
      </div>
      ${imp.modo === 'semanal' ? `
        <label class="campo">Semana de la planilla
          <select data-cambio="importar-semana">${imp.semanas.map((s, i) => `<option value="${i}" ${i === imp.semana ? 'selected' : ''}>${esc(s.nombre)}</option>`).join('')}</select>
        </label>
        <p class="nota-chica">Se repite todas las semanas, como la rutina semanal.</p>`
      : `
        <label class="campo">Empieza la semana del
          <input type="date" value="${imp.inicio}" data-cambio="importar-inicio">
        </label>
        <p class="nota-chica">${esc(imp.semanas[0].nombre)} va del ${fechaLarga(imp.inicio)} en adelante, y así hasta el ${fechaLarga(fin)}. Después sigue la ${esc(imp.semanas[0].nombre)} como rutina semanal.</p>`}
    </div>

    <div class="tarjeta">
      <h3>¿Qué día de la semana es cada uno?</h3>
      ${semana.dias.map((d, i) => `
        <label class="campo fila-dia">${esc(d.titulo)}
          <select data-cambio="importar-dia" data-indice="${i}">${opcionesDia(imp.dias[i])}</select>
        </label>`).join('')}
      ${repetidos ? '<p class="error">Hay dos días de la planilla en el mismo día de la semana: el segundo reemplazaría al primero.</p>' : ''}
    </div>

    ${semana.dias.map((d, i) => `
      <div class="tarjeta vista-dia">
        <h3>${DIAS[imp.dias[i]]} · ${esc(d.titulo)}</h3>
        ${d.ejercicios.map(e => `<div class="fila-vista">
            <span><b>${esc(e.nombre)}</b> <small class="musculo">${esc(e.musculo)}</small>${e.nota ? `<br><small class="suave">${esc(e.nota)}</small>` : ''}</span>
            <span class="vista-datos">${e.series} × ${esc(repsDe(e))}${e.peso ? ` · ${formatoPeso(e.peso)}` : ''}</span>
          </div>`).join('')}
      </div>`).join('')}

    <p class="nota-chica">Los días de la semana que no están en la planilla no se tocan. Los días que sí están se reemplazan por lo de la planilla.</p>
    <div class="fila-botones">
      <button class="boton secundario" data-accion="importar-cancelar">Cancelar</button>
      <button class="boton" data-accion="importar-guardar" ${repetidos ? 'disabled' : ''}>Guardar rutina</button>
    </div>`;
}

// Pasa la planilla a la rutina del alumno
function guardarImportacion(alumna) {
  const imp = ui.importacion;
  const copia = x => JSON.parse(JSON.stringify(x));
  const rutinas = datos.rutinas[alumna.id] || (datos.rutinas[alumna.id] = {});
  const base = imp.semanas[imp.modo === 'mes' ? 0 : imp.semana];
  base.dias.forEach((d, i) => { rutinas[imp.dias[i]] = copia(d.ejercicios); });
  if (imp.modo === 'mes') {
    const cambios = cambiosDe(alumna.id);
    imp.semanas.forEach((semana, s) => semana.dias.forEach((d, i) => {
      cambios[sumarDias(imp.inicio, s * 7 + (imp.dias[i] + 6) % 7)] = copia(d.ejercicios);
    }));
  }
  ui.importacion = null;
  guardarFicha(alumna.id, 'importacion');
}

// Lista de ejercicios para armar o cambiar una rutina (la usan el profesor y el alumno)
function editorRutina(alumna) {
  const items = rutinaEditable(alumna.id).map((ej, i) => `
    <article class="tarjeta ejercicio">
      <div class="ejercicio-titulo">
        <div><small class="musculo">${esc(ej.musculo)}</small><h3>${esc(ej.nombre)}</h3>
          ${ej.porAlumno && perfil.rol === 'profesor' ? '<em class="etiqueta-propio">Cambio del alumno</em>' : ''}${notaDe(ej)}</div>
        <div class="acciones-ejercicio">
          <button class="boton-texto" data-accion="reemplazar" data-valor="${i}">Cambiar</button>
          <button class="boton-icono" data-accion="quitar" data-valor="${i}" aria-label="Quitar ejercicio">✕</button>
        </div>
      </div>
      <div class="ajustes">
        ${ajuste(i, 'series', 'Series', ej.series)}
        ${ajuste(i, 'reps', 'Reps', esc(repsDe(ej)))}
        ${ajuste(i, 'peso', 'Peso', formatoPeso(ej.peso))}
        ${ajuste(i, 'pausa', 'Pausa', formatoPausa(ej.pausa))}
      </div>
    </article>`).join('');
  return `${items || '<div class="tarjeta vacio">Este día no tiene ejercicios todavía.</div>'}
    ${ui.agregando ? selectorEjercicios(alumna) : '<button class="boton ancho" data-accion="abrir-agregar">+ Agregar ejercicio</button>'}`;
}

// Mensaje que el profesor le deja a la alumna en su pantalla de Progreso
function notaProgreso(alumna) {
  return `<h2>Mensaje de progreso</h2>
    <form class="tarjeta" data-form="nota">
      <label class="campo">Lo ve ${esc(alumna.nombre.split(' ')[0])} al final de su pantalla de Progreso
        <textarea name="nota" rows="3" maxlength="400" placeholder="Ej.: Subiste 10 kg en sentadilla en 6 semanas. Próximo objetivo: 50 kg.">${esc(datos.notasProgreso[alumna.id] || '')}</textarea>
      </label>
      <button type="submit" class="boton secundario ancho">Guardar mensaje</button>
    </form>`;
}

// Evaluación inicial: datos de la alumna y resultados de tests/ejercicios
function profesorEvaluacion(alumna) {
  const ev = datos.evaluaciones[alumna.id] || {};
  const tests = ev.tests || [];
  const opcion = (lista, elegido) => lista.map(o => `<option ${o === elegido ? 'selected' : ''}>${esc(o)}</option>`).join('');
  return `<form class="tarjeta" data-form="evaluacion">
      <h3>Datos iniciales</h3>
      <div class="grilla-2">
        <label class="campo">Fecha<input type="date" name="fecha" value="${esc(ev.fecha || fechaISO())}"></label>
        <label class="campo">Nivel<select name="nivel">${opcion(NIVELES, ev.nivel)}</select></label>
        <label class="campo">Peso corporal (kg)<input type="number" name="pesoCorporal" min="0" step="0.1" inputmode="decimal" value="${ev.pesoCorporal ?? ''}"></label>
        <label class="campo">Altura (cm)<input type="number" name="altura" min="0" step="1" inputmode="numeric" value="${ev.altura ?? ''}"></label>
      </div>
      <label class="campo">Objetivo<select name="objetivo">${opcion(OBJETIVOS, ev.objetivo)}</select></label>
      <label class="campo">Lesiones o antecedentes
        <textarea name="antecedentes" rows="2" maxlength="400" placeholder="Ej.: Dolor lumbar al levantar peso del piso">${esc(ev.antecedentes || '')}</textarea></label>
      <label class="campo">Observaciones
        <textarea name="observaciones" rows="2" maxlength="400" placeholder="Ej.: Buena movilidad. Trabajar técnica de sentadilla">${esc(ev.observaciones || '')}</textarea></label>
      <button type="submit" class="boton ancho">Guardar datos</button>
    </form>

    <h2>Tests y ejercicios</h2>
    <p class="suave">Anotá el resultado de cada test. Podés cambiar el número directamente.</p>
    ${tests.map((t, i) => `
      <div class="tarjeta test">
        <div class="fila-separada">
          <strong>${esc(t.nombre)}</strong>
          <button class="boton-icono" data-accion="quitar-test" data-valor="${i}" aria-label="Quitar test">✕</button>
        </div>
        <div class="test-resultado">
          <input type="number" min="0" step="0.5" inputmode="decimal" value="${t.resultado}" data-cambio="test-resultado" data-indice="${i}" aria-label="Resultado">
          <span>${esc(t.unidad)}</span>
        </div>
        ${t.nota ? `<small class="suave">${esc(t.nota)}</small>` : ''}
      </div>`).join('') || '<div class="tarjeta vacio">Todavía no hay tests cargados.</div>'}
    ${ui.agregandoTest ? `
      <form class="tarjeta selector" data-form="nuevo-test">
        <div class="fila-separada"><h3>Agregar test</h3>
          <button type="button" class="boton-icono" data-accion="cerrar-test" aria-label="Cerrar">✕</button></div>
        <label class="campo">Test o ejercicio
          <select name="test" data-cambio="tipo-test">
            ${TESTS.map(([n, u]) => `<option value="${esc(n)}" ${ui.testElegido === n ? 'selected' : ''}>${esc(n)} (${u})</option>`).join('')}
            <option value="otro" ${ui.testElegido === 'otro' ? 'selected' : ''}>Otro: crear mi propio test</option>
          </select></label>
        ${ui.testElegido === 'otro' ? `
          <div class="grilla-2">
            <label class="campo">Nombre<input name="nombre" required maxlength="50" placeholder="Ej.: Equilibrio en 1 pie"></label>
            <label class="campo">Unidad<select name="unidad">${opcion(UNIDADES)}</select></label>
          </div>` : ''}
        <label class="campo">Resultado<input name="resultado" type="number" required min="0" step="0.5" inputmode="decimal" placeholder="Ej.: 30"></label>
        <label class="campo">Nota (opcional)<input name="nota" maxlength="80" placeholder="Ej.: Con rodillas apoyadas"></label>
        <button type="submit" class="boton ancho">Agregar test</button>
      </form>`
    : '<button class="boton ancho" data-accion="abrir-test">+ Agregar test o ejercicio</button>'}`;
}

// Un valor con botones − y + para cambiarlo rápido
function ajuste(indice, campo, etiqueta, valor) {
  return `<div class="ajuste">
    <small>${etiqueta}</small>
    <div class="ajuste-controles">
      <button data-accion="paso" data-indice="${indice}" data-campo="${campo}" data-delta="-1" aria-label="Menos ${etiqueta}">−</button>
      <b>${valor}</b>
      <button data-accion="paso" data-indice="${indice}" data-campo="${campo}" data-delta="1" aria-label="Más ${etiqueta}">+</button>
    </div>
  </div>`;
}

// Cuánto sube o baja cada valor al tocar − o +
const PASOS = { series: 1, reps: 1, peso: 2.5, pausa: 15 };
const MINIMOS = { series: 1, reps: 1, peso: 0, pausa: 0 };

function selectorEjercicios(alumna) {
  const musculos = Object.keys(CATALOGO[alumna.disciplina]);
  if (!musculos.includes(ui.musculo)) ui.musculo = musculos[0];
  const rutina = rutinaEditable(alumna.id);
  const yaEstan = rutina.map(e => e.nombre);
  const cambiando = ui.reemplazando !== null && rutina[ui.reemplazando];
  return `<div class="tarjeta selector">
    <div class="fila-separada"><h3>${cambiando ? `Cambiar ${esc(cambiando.nombre)} por…` : 'Agregar ejercicio'}</h3>
      <button class="boton-icono" data-accion="cerrar-agregar" aria-label="Cerrar">✕</button></div>
    <div class="chips">${musculos.map(m =>
      `<button class="chip ${ui.musculo === m ? 'activa' : ''}" data-accion="musculo" data-valor="${esc(m)}">${esc(m)}</button>`).join('')}
    </div>
    <div class="lista-ejercicios">${ejerciciosDe(alumna.disciplina, ui.musculo).map(([nombre, peso, propio]) => {
      const esta = yaEstan.includes(nombre);
      return `<button class="opcion" data-accion="agregar" data-valor="${esc(nombre)}" data-peso="${peso}">
        <span>${esc(nombre)}${propio ? ' <em class="etiqueta-propio">Propio</em>' : ''}</span>
        <small>${esta ? 'En la rutina · +' : formatoPeso(peso) + ' · +'}</small></button>`;
    }).join('')}</div>
    ${ui.creando ? `
      <form class="crear-ejercicio" data-form="crear-ejercicio">
        <p class="registro-titulo">Crear mi propio ejercicio (${esc(ui.musculo)})</p>
        <label class="campo">Nombre<input name="nombre" required maxlength="40" placeholder="Ej.: Sentadilla búlgara"></label>
        <label class="campo">Peso sugerido (kg, 0 = sin peso)<input name="peso" type="number" min="0" step="0.5" inputmode="decimal" value="0"></label>
        <div class="fila-botones">
          <button type="button" class="boton secundario" data-accion="cerrar-crear">Cancelar</button>
          <button type="submit" class="boton">${cambiando ? 'Crear y cambiar' : 'Crear y agregar'}</button>
        </div>
      </form>`
    : `<button class="boton secundario ancho crear-boton" data-accion="abrir-crear">+ Crear mi propio ejercicio</button>`}
  </div>`;
}

function profesorEncuestas() {
  const lista = datos.encuestas.filter(e => e.area === 'gimnasio');
  const promedio = lista.length ? lista.reduce((s, e) => s + e.puntaje, 0) / lista.length : 0;
  return `<h1>Encuestas del gimnasio</h1>
    <div class="resumen">
      <div class="tarjeta"><b class="oro">${promedio.toFixed(1).replace('.', ',')} ★</b><small>Promedio</small></div>
      <div class="tarjeta"><b>${lista.length}</b><small>Respuestas</small></div>
    </div>
    ${lista.slice().reverse().map(tarjetaEncuesta).join('') || '<div class="tarjeta vacio">Todavía no hay respuestas.</div>'}`;
}

/* ---------- Paciente (Kinesiología: próximo pedido) ---------- */

function pantallaPaciente() {
  return proximamente('Kinesiología', 'Pronto vas a sacar turno desde acá y ver qué se hizo en cada sesión. Primera sesión: evaluamos, planificamos y arrancamos.');
}

function proximamente(titulo, texto) {
  return `<h1>${titulo}</h1>
    <div class="tarjeta vacio"><span class="etiqueta-oro">Próximamente</span><p>${texto}</p></div>`;
}

/* ---------- Qué pasa al tocar cada botón ---------- */

app.addEventListener('click', ev => {
  const b = ev.target.closest('[data-accion]');
  if (!b || b.disabled) return;
  const v = b.dataset.valor;
  // Al cambiar de pantalla, se vuelve arriba de todo
  if (['pestana', 'elegir-alumna', 'volver', 'seccion-alumna', 'avisos', 'ir-alumno'].includes(b.dataset.accion)) window.scrollTo(0, 0);

  switch (b.dataset.accion) {
    case 'salir':
      ui.errorIngreso = '';
      servidor.salir(); // al cerrar la sesión, alCambiarSesion vuelve a la pantalla de ingreso
      return;
    case 'cargar-ejemplo': cargarEjemplo(); return;
    case 'tipo-ingreso': ui.tipoIngreso = v; ui.errorIngreso = ''; break;
    case 'elegir-entrenador': ui.entrenadorId = v; window.scrollTo(0, 0); break;
    case 'volver-entrenadores': ui.entrenadorId = null; break;
    case 'abrir-nuevo-entrenador': ui.nuevoEntrenador = true; ui.errorEntrenador = ''; break;
    case 'cerrar-nuevo-entrenador': ui.nuevoEntrenador = false; break;
    case 'restablecer-entrenador': {
      const e = datos.entrenadores.find(x => x.uid === ui.entrenadorId);
      if (!confirm(`¿Generar un código nuevo para ${e.nombre}? Su contraseña o código actual dejan de servir, y con el nuevo código crea otra contraseña. Sus alumnos siguen siendo suyos.`)) return;
      ui.ocupado = true; dibujar();
      servidor.restablecerEntrenador(e)
        .then(({ uid, codigo }) => {
          const viejo = e.uid;
          Object.assign(e, { uid, codigoInicial: codigo, debeCambiarClave: true });
          datos.alumnas.filter(a => a.entrenadorUid === viejo).forEach(a => { a.entrenadorUid = uid; });
          ui.entrenadorId = uid;
          mostrarAviso('Código nuevo generado');
        })
        .catch(mostrarError)
        .finally(() => { ui.ocupado = false; dibujar(); });
      return;
    }
    case 'avisos': {
      ui.verAvisos = !ui.verAvisos;
      // Al abrir la lista, las notificaciones quedan como leídas
      const sinLeer = avisos.filter(a => !a.leido).map(a => a.id);
      if (ui.verAvisos && sinLeer.length) servidor.marcarLeidos(perfil, sinLeer).catch(e => console.error(e));
      break;
    }
    case 'ir-alumno':
      ui.verAvisos = false; ui.pestana = 'alumnas'; ui.alumnaId = v; ui.seccionAlumna = 'rutina';
      ui.agregando = false; ui.creando = false; ui.modoRutina = 'semanal'; ui.dia = new Date().getDay(); ui.fechaRutina = fechaISO();
      break;
    case 'pestana':
      ui.entrenadorId = null; ui.nuevoEntrenador = false;
      ui.verAvisos = false; ui.editando = false; ui.eligiendoAlcance = false; ui.reemplazando = null;
      ui.pestana = v; ui.alumnaId = null; ui.agregando = false; ui.creando = false; ui.registrando = null;
      ui.dia = new Date().getDay(); ui.fecha = fechaISO(); ui.estrellas = 0; ui.comentario = '';
      break;
    case 'dia':
      ui.dia = Number(v); ui.registrando = null;
      break;
    case 'fecha-alumna': ui.fecha = v; ui.registrando = null; ui.editando = false; ui.eligiendoAlcance = false; ui.agregando = false;
      ui.sensacion = null; ui.comentarioDia = ''; ui.editandoDiario = false; break;
    case 'fecha-rutina': ui.fechaRutina = v; ui.agregando = false; break;
    case 'modo-rutina': ui.modoRutina = v; ui.agregando = false; ui.creando = false; break;
    case 'personalizar-fecha': {
      // Copia la rutina semanal de ese día como punto de partida
      const semanal = rutinaDe(ui.alumnaId, diaDeSemana(ui.fechaRutina));
      cambiosDe(ui.alumnaId)[ui.fechaRutina] = JSON.parse(JSON.stringify(semanal));
      guardarFicha(ui.alumnaId); mostrarAviso('Ahora podés cambiar solo esta fecha'); return;
    }
    case 'quitar-cambios':
      if (!confirm(`¿Borrar los cambios del ${fechaLarga(ui.fechaRutina)} y volver a la rutina semanal?`)) return;
      delete cambiosDe(ui.alumnaId)[ui.fechaRutina];
      guardarFicha(ui.alumnaId); mostrarAviso('Volvió a la rutina semanal'); return;
    // Alumno: cambiar su propia rutina
    case 'cambiar-mi-rutina':
      ui.alumnaId = perfil.alumnaId; ui.registrando = null;
      // Si ese día ya tiene una rutina especial, se cambia esa directamente
      if (cambiosDe(perfil.alumnaId)[ui.fecha]) { ui.editando = true; ui.modoRutina = 'fecha'; ui.fechaRutina = ui.fecha; }
      else ui.eligiendoAlcance = true;
      break;
    case 'editar-mi-rutina':
      ui.eligiendoAlcance = false; ui.editando = true; ui.agregando = false; ui.reemplazando = null;
      ui.modoRutina = v; ui.fechaRutina = ui.fecha; ui.dia = diaDeSemana(ui.fecha);
      if (v === 'fecha') {
        cambiosDe(perfil.alumnaId)[ui.fecha] = JSON.parse(JSON.stringify(rutinaDe(perfil.alumnaId, ui.dia)));
        guardarFicha(perfil.alumnaId);
      }
      break;
    case 'cancelar-edicion': ui.eligiendoAlcance = false; break;
    case 'terminar-edicion':
      ui.editando = false; ui.agregando = false; ui.creando = false; ui.reemplazando = null;
      mostrarAviso('Rutina guardada'); return;
    // Alumno: registrar
    case 'ver-ejercicio': ui.ejercicioGrafico = v; break;
    case 'sensacion': ui.sensacion = v; vibrar(15); break;
    case 'editar-diario': ui.editandoDiario = true; ui.sensacion = null; ui.comentarioDia = ''; break;
    case 'dia-profe': ui.diaProfe = v; break;
    case 'mes': {
      const [a, m] = ui.mes.split('-').map(Number);
      ui.mes = fechaISO(new Date(a, m - 1 + Number(v), 1)).slice(0, 7);
      break;
    }
    case 'registrar': ui.registrando = Number(v); break;
    case 'cancelar-registro': ui.registrando = null; break;
    case 'estrella': ui.estrellas = Number(v); break;
    // Profesor
    case 'filtro': ui.filtro = v; ui.nuevaAlumna = false; break;
    case 'elegir-alumna':
      ui.alumnaId = v; ui.agregando = false; ui.creando = false;
      ui.seccionAlumna = 'rutina'; ui.agregandoTest = false;
      ui.dia = new Date().getDay(); ui.modoRutina = 'semanal'; ui.fechaRutina = fechaISO();
      ui.mes = fechaISO().slice(0, 7); ui.diaProfe = fechaISO();
      break;
    case 'volver': ui.importacion = null; ui.alumnaId = null; ui.agregando = false; ui.creando = false; break;
    case 'seccion-alumna': ui.seccionAlumna = v; ui.agregandoTest = false; break;
    case 'restablecer-clave': {
      const alumna = alumnaPorId(ui.alumnaId);
      if (!confirm(`¿Generar un código nuevo para ${alumna.nombre}? Su contraseña o código actual dejan de servir, y con el nuevo código crea otra contraseña.`)) return;
      ui.ocupado = true; dibujar();
      servidor.restablecer(alumna)
        .then(codigo => { alumna.codigoInicial = codigo; alumna.debeCambiarClave = true; mostrarAviso('Código nuevo generado'); })
        .catch(mostrarError)
        .finally(() => { ui.ocupado = false; dibujar(); });
      return;
    }
    case 'abrir-test': ui.agregandoTest = true; ui.testElegido = TESTS[0][0]; break;
    case 'cerrar-test': ui.agregandoTest = false; break;
    case 'quitar-test':
      datos.evaluaciones[ui.alumnaId].tests.splice(Number(v), 1);
      guardarFicha(ui.alumnaId, 'evaluacion');
      break;
    case 'abrir-nueva-alumna': ui.nuevaAlumna = true; ui.errorAlumna = ''; break;
    case 'cerrar-nueva-alumna': ui.nuevaAlumna = false; break;
    case 'importar-modo': ui.importacion.modo = v; break;
    case 'importar-cancelar': ui.importacion = null; break;
    case 'importar-guardar': guardarImportacion(alumnaPorId(ui.alumnaId)); window.scrollTo(0, 0); mostrarAviso('Rutina cargada desde el Excel'); return;
    case 'abrir-agregar': ui.agregando = true; ui.reemplazando = null; break;
    case 'cerrar-agregar': ui.agregando = false; ui.creando = false; ui.reemplazando = null; break;
    case 'reemplazar': ui.agregando = true; ui.creando = false; ui.reemplazando = Number(v); break;
    case 'abrir-crear': ui.creando = true; break;
    case 'cerrar-crear': ui.creando = false; break;
    case 'musculo': ui.musculo = v; ui.creando = false; break;
    case 'agregar': {
      const alumna = alumnaPorId(ui.alumnaId);
      const cambiado = ponerEjercicio(alumna, itemRutina(alumna.disciplina, v, 3, 10, Number(b.dataset.peso), 60, ui.musculo));
      guardarFicha(alumna.id); mostrarAviso(cambiado ? 'Ejercicio cambiado' : 'Ejercicio agregado'); return;
    }
    case 'quitar':
      rutinaEditable(ui.alumnaId).splice(Number(v), 1);
      guardarFicha(ui.alumnaId);
      break;
    case 'paso': {
      const ej = rutinaEditable(ui.alumnaId)[Number(b.dataset.indice)];
      const campo = b.dataset.campo;
      ej[campo] = Math.max(MINIMOS[campo], ej[campo] + Number(b.dataset.delta) * PASOS[campo]);
      if (campo === 'reps') delete ej.repsTexto; // al tocar − / + pasa a ser un número fijo
      marcarAutor(ej);
      guardarFicha(ui.alumnaId);
      break;
    }
  }
  dibujar();
});

app.addEventListener('change', ev => {
  const cambio = ev.target.dataset.cambio;
  if (cambio === 'ejercicio-grafico') { ui.ejercicioGrafico = ev.target.value; dibujar(); }
  if (cambio === 'fecha-alumna' && ev.target.value) {
    ui.fecha = ev.target.value; ui.registrando = null; ui.sensacion = null; ui.comentarioDia = ''; ui.editandoDiario = false; dibujar();
  }
  if (cambio === 'fecha-rutina' && ev.target.value) { ui.fechaRutina = ev.target.value; ui.agregando = false; dibujar(); }
  if (cambio === 'tipo-test') { ui.testElegido = ev.target.value; dibujar(); }
  if (cambio === 'importar-semana') { ui.importacion.semana = Number(ev.target.value); dibujar(); }
  if (cambio === 'importar-inicio' && ev.target.value) { ui.importacion.inicio = lunesDe(ev.target.value); dibujar(); }
  if (cambio === 'importar-dia') { ui.importacion.dias[Number(ev.target.dataset.indice)] = Number(ev.target.value); dibujar(); }
  if (cambio === 'subir-excel' && ev.target.files[0]) {
    const archivo = ev.target.files[0];
    ui.ocupado = true; dibujar();
    leerPlanilla(archivo)
      .then(({ semanas }) => {
        const maxDias = Math.max(...semanas.map(s => s.dias.length));
        ui.importacion = {
          archivo: archivo.name, semanas, modo: 'semanal', semana: 0,
          inicio: sumarDias(lunesDe(fechaISO()), 7),                       // el lunes que viene
          dias: Array.from({ length: maxDias }, (_, i) => (i + 1) % 7)      // Día 1 = lunes, Día 2 = martes…
        };
        window.scrollTo(0, 0);
      })
      .catch(mostrarError)
      .finally(() => { ui.ocupado = false; dibujar(); });
  }
  if (cambio === 'test-resultado') {
    const test = datos.evaluaciones[ui.alumnaId].tests[Number(ev.target.dataset.indice)];
    test.resultado = Math.max(0, Number(ev.target.value) || 0);
    guardarFicha(ui.alumnaId, 'evaluacion'); mostrarAviso('Resultado guardado');
  }
});

// Marca si el ejercicio lo cambió el alumno (el profesor lo ve con una etiqueta)
function marcarAutor(ej) {
  if (perfil.rol === 'alumna') ej.porAlumno = true;
  else delete ej.porAlumno;
}

// Agrega un ejercicio a la rutina que se está editando, o reemplaza al que se eligió "Cambiar".
// Al reemplazar, conserva las series, repeticiones y pausa del anterior. Devuelve true si reemplazó.
function ponerEjercicio(alumna, nuevo) {
  const rutina = rutinaEditable(alumna.id);
  const anterior = ui.reemplazando !== null ? rutina[ui.reemplazando] : null;
  marcarAutor(nuevo);
  if (anterior) {
    Object.assign(nuevo, { series: anterior.series, reps: anterior.reps, pausa: anterior.pausa });
    rutina[ui.reemplazando] = nuevo;
    ui.reemplazando = null; ui.agregando = false;
    return true;
  }
  rutina.push(nuevo);
  return false;
}

// Devuelve la evaluación de la alumna elegida (la crea vacía si no existe)
function evaluacionActual() {
  return datos.evaluaciones[ui.alumnaId] || (datos.evaluaciones[ui.alumnaId] = { fecha: fechaISO(), tests: [] });
}

app.addEventListener('input', ev => {
  if (ev.target.name === 'comentario') ui.comentario = ev.target.value;
  if (ev.target.name === 'comentario-dia') ui.comentarioDia = ev.target.value;
});

app.addEventListener('submit', ev => {
  ev.preventDefault();
  const f = ev.target;
  const campos = new FormData(f);
  const num = (nombre, min) => Math.max(min, Number(campos.get(nombre)) || 0);

  if (f.dataset.form === 'ingreso') {
    ui.errorIngreso = ''; ui.ocupado = true; dibujar();
    // Si los datos coinciden, alCambiarSesion se encarga de traer los datos y mostrar la app
    servidor.ingresar(String(campos.get('usuario')), String(campos.get('clave')), ui.tipoIngreso)
      .catch(e => { ui.errorIngreso = mensajeError(e); })
      .finally(() => { ui.ocupado = false; dibujar(); });
  }

  if (f.dataset.form === 'crear-clave') {
    const clave = String(campos.get('clave'));
    ui.errorIngreso = '';
    if (clave.length < 6) ui.errorIngreso = 'La contraseña tiene que tener al menos 6 caracteres.';
    else if (clave !== campos.get('repetir')) ui.errorIngreso = 'Las dos contraseñas no son iguales. Escribilas de nuevo.';
    else {
      ui.ocupado = true; dibujar();
      servidor.cambiarClave(perfil, clave)
        .then(() => {
          perfil.debeCambiarClave = false;
          dejarDeEscuchar = servidor.escucharAvisos(perfil, lista => { avisos = lista; actualizarCampana(); });
          mostrarAviso('Contraseña creada. ¡Te damos la bienvenida!');
        })
        .catch(e => { ui.errorIngreso = mensajeError(e); })
        .finally(() => { ui.ocupado = false; dibujar(); });
      return;
    }
    dibujar();
  }

  if (f.dataset.form === 'registro') {
    const fecha = ui.fecha;
    if (fecha > fechaISO()) return; // no se registran días que todavía no llegaron
    const ej = rutinaDeFecha(perfil.alumnaId, fecha)[Number(f.dataset.indice)];
    const registro = {
      alumnaId: perfil.alumnaId, nombre: ej.nombre, fecha,
      series: Math.round(num('series', 1)), reps: Math.round(num('reps', 0)),
      peso: num('peso', 0), pausa: Math.round(num('pausa', 0))
    };
    // Si ya había un registro de esa fecha para ese ejercicio, se reemplaza
    datos.registros = datos.registros.filter(r => !(r.alumnaId === perfil.alumnaId && r.nombre === ej.nombre && r.fecha === fecha));
    // ¿Es un récord? (supera el mejor peso anterior de ese ejercicio)
    const anteriores = datos.registros.filter(r => r.alumnaId === perfil.alumnaId && r.nombre === ej.nombre);
    const esRecord = registro.peso > 0 && anteriores.length > 0 && registro.peso > Math.max(...anteriores.map(r => r.peso));
    const rutinaDelDia = rutinaDeFecha(perfil.alumnaId, fecha);
    const completaAntes = rutinaDelDia.every(e => registroDe(perfil.alumnaId, e.nombre, fecha));
    datos.registros.push(registro);
    const completaAhora = rutinaDelDia.every(e => registroDe(perfil.alumnaId, e.nombre, fecha));
    const recienCompleta = completaAhora && !completaAntes;
    ui.registrando = null;
    ui.recien = ej.nombre + '|' + fecha; // el tilde aparece con un saltito (una sola vez)
    setTimeout(() => { ui.recien = ''; }, 1200);
    mostrarAviso(esRecord ? `🏆 ¡Nuevo récord en ${ej.nombre}: ${formatoPeso(registro.peso)}!`
      : recienCompleta ? '🎉 ¡Rutina completa! Muy buen trabajo' : 'Registro guardado. Sumaste progreso');
    if (esRecord || recienCompleta) festejar(); else vibrar(20);
    if (recienCompleta) servidor.avisarAlProfe(perfil.alumnaId, `🎉 ${perfil.nombre} completó su rutina del ${fechaLarga(fecha)}.`, perfil.entrenadorUid).catch(e => console.error(e));
    servidor.guardarRegistro(perfil.alumnaId, registro).catch(mostrarError);
    servidor.avisarAlProfe(perfil.alumnaId,
      `${esRecord ? '🏆 Nuevo récord: ' : ''}${perfil.nombre} registró ${ej.nombre} (${fechaLarga(fecha)}): ${registro.series} × ${registro.reps} con ${formatoPeso(registro.peso)}.`, perfil.entrenadorUid)
      .catch(e => console.error(e));
  }

  if (f.dataset.form === 'diario') {
    const fecha = ui.fecha;
    const sensacion = ui.sensacion || datos.diario[perfil.alumnaId]?.[fecha]?.sensacion;
    if (!sensacion) return;
    const comentario = String(campos.get('comentario-dia') || '').trim().slice(0, 300);
    (datos.diario[perfil.alumnaId] ||= {})[fecha] = { sensacion, comentario };
    ui.sensacion = null; ui.comentarioDia = ''; ui.editandoDiario = false;
    const [, carita, texto] = sensacionDe(sensacion);
    mostrarAviso(sensacion === 'costo' ? 'Gracias por contarlo. Tu entrenador lo va a ver 🤝' : `${carita} ¡Gracias por contarlo!`);
    vibrar(20);
    servidor.guardarDiario(perfil.alumnaId, fecha, { sensacion, comentario }).catch(mostrarError);
    servidor.avisarAlProfe(perfil.alumnaId,
      `${carita} ${perfil.nombre} contó cómo le fue el ${fechaLarga(fecha)}: ${texto}${comentario ? ` — “${comentario}”` : ''}`, perfil.entrenadorUid)
      .catch(e => console.error(e));
  }

  if (f.dataset.form === 'encuesta') {
    if (!ui.estrellas) return;
    const respuesta = { area: f.dataset.area, autor: perfil.nombre, alumnaId: perfil.alumnaId, entrenadorUid: perfil.entrenadorUid || '', fecha: fechaISO(), puntaje: ui.estrellas, comentario: String(campos.get('comentario') || '').trim().slice(0, 300) };
    datos.encuestas.push(respuesta);
    ui.estrellas = 0; ui.comentario = '';
    mostrarAviso('Gracias. Tu respuesta ya llegó');
    servidor.agregarEncuesta(respuesta).catch(mostrarError);
    servidor.avisarAlProfe(perfil.alumnaId, `${perfil.nombre} respondió la encuesta: ${'★'.repeat(respuesta.puntaje)}.`, perfil.entrenadorUid).catch(e => console.error(e));
  }

  if (f.dataset.form === 'nueva-alumna') {
    const nombre = String(campos.get('nombre') || '').trim();
    const dni = String(campos.get('dni') || '').replace(/\D/g, '');
    if (!nombre || !dni) return;
    if (datos.alumnas.some(a => a.dni === dni)) { ui.errorAlumna = 'Ya hay un alumno con ese DNI.'; dibujar(); return; }
    const disciplina = String(campos.get('disciplina'));
    ui.ocupado = true; ui.errorAlumna = ''; dibujar();
    // Se crea con un código de primer ingreso; el alumno después crea su contraseña
    servidor.crearAlumna({ nombre, dni, disciplina }, entrenadorActual())
      .then(({ id, codigo }) => {
        datos.alumnas.push({ id, nombre, dni, disciplina, debeCambiarClave: true, codigoInicial: codigo, ...entrenadorEnFicha() });
        datos.alumnas.sort((a, b) => a.nombre.localeCompare(b.nombre));
        datos.rutinas[id] = {};
        ui.nuevaAlumna = false;
        // Abre su ficha, donde se ve el código para pasárselo
        ui.alumnaId = id; ui.seccionAlumna = 'rutina'; ui.dia = new Date().getDay();
        window.scrollTo(0, 0);
        mostrarAviso('Alumno creado');
      })
      .catch(e => { ui.errorAlumna = mensajeError(e); })
      .finally(() => { ui.ocupado = false; dibujar(); });
  }

  if (f.dataset.form === 'nuevo-entrenador') {
    const nombre = String(campos.get('nombre') || '').trim();
    const dni = String(campos.get('dni') || '').replace(/\D/g, '');
    if (!nombre || !dni) return;
    if (datos.entrenadores.some(e => e.dni === dni)) { ui.errorEntrenador = 'Ya hay un entrenador con ese DNI.'; dibujar(); return; }
    ui.ocupado = true; ui.errorEntrenador = ''; dibujar();
    servidor.crearEntrenador({ nombre, dni })
      .then(entrenador => {
        datos.entrenadores.push(entrenador);
        datos.entrenadores.sort((a, b) => a.nombre.localeCompare(b.nombre));
        ui.nuevoEntrenador = false; ui.entrenadorId = entrenador.uid; // abre su ficha con el código
        window.scrollTo(0, 0);
        mostrarAviso('Entrenador creado');
      })
      .catch(e => { ui.errorEntrenador = mensajeError(e); })
      .finally(() => { ui.ocupado = false; dibujar(); });
  }

  if (f.dataset.form === 'crear-ejercicio') {
    const alumna = alumnaPorId(ui.alumnaId);
    const nombre = String(campos.get('nombre') || '').trim();
    if (!nombre) return;
    const peso = num('peso', 0);
    const porMusculo = datos.ejerciciosPropios[alumna.disciplina] || (datos.ejerciciosPropios[alumna.disciplina] = {});
    const lista = porMusculo[ui.musculo] || (porMusculo[ui.musculo] = []);
    // Queda guardado en la lista para usarlo con cualquier alumna
    // (solo el profesor la guarda en la lista compartida; el alumno lo suma a su rutina)
    if (perfil.rol === 'profesor' && !ejerciciosDe(alumna.disciplina, ui.musculo).some(e => e[0].toLowerCase() === nombre.toLowerCase())) {
      lista.push({ nombre, peso });
      servidor.guardarEjerciciosPropios(datos.ejerciciosPropios, perfil.uid).catch(mostrarError);
    }
    const cambiado = ponerEjercicio(alumna, itemRutina(alumna.disciplina, nombre, 3, 10, peso, 60, ui.musculo));
    ui.creando = false;
    guardarFicha(alumna.id); mostrarAviso(cambiado ? 'Ejercicio creado y cambiado' : 'Ejercicio creado y agregado');
  }

  if (f.dataset.form === 'evaluacion') {
    const ev = evaluacionActual();
    ev.fecha = String(campos.get('fecha') || fechaISO());
    ev.nivel = campos.get('nivel');
    ev.objetivo = campos.get('objetivo');
    ev.pesoCorporal = Number(campos.get('pesoCorporal')) || null;
    ev.altura = Number(campos.get('altura')) || null;
    ev.antecedentes = String(campos.get('antecedentes') || '').trim();
    ev.observaciones = String(campos.get('observaciones') || '').trim();
    guardarFicha(ui.alumnaId, 'evaluacion'); mostrarAviso('Evaluación guardada');
  }

  if (f.dataset.form === 'nuevo-test') {
    const elegido = String(campos.get('test'));
    const base = TESTS.find(t => t[0] === elegido);
    const nombre = base ? base[0] : String(campos.get('nombre') || '').trim();
    if (!nombre) return;
    evaluacionActual().tests.push({
      nombre, unidad: base ? base[1] : String(campos.get('unidad')),
      resultado: num('resultado', 0), nota: String(campos.get('nota') || '').trim()
    });
    ui.agregandoTest = false;
    guardarFicha(ui.alumnaId, 'evaluacion'); mostrarAviso('Test agregado');
  }

  if (f.dataset.form === 'nota') {
    const nota = String(campos.get('nota') || '').trim().slice(0, 400);
    if (nota) datos.notasProgreso[ui.alumnaId] = nota;
    else delete datos.notasProgreso[ui.alumnaId];
    guardarFicha(ui.alumnaId, 'nota'); mostrarAviso('Mensaje guardado');
  }
});

// Quién queda como entrenador de un alumno nuevo: quien lo crea (la administradora = vacío)
function entrenadorActual() { return { uid: perfil.uid || '', nombre: perfil.esAdmin ? '' : perfil.nombre }; }
function entrenadorEnFicha() { const e = entrenadorActual(); return { entrenadorUid: e.uid, entrenadorNombre: e.nombre }; }

// Carga en el servidor las alumnas de ejemplo (cada una con su código de primer ingreso)
async function cargarEjemplo() {
  if (!confirm('¿Cargar 3 alumnos de ejemplo (datos inventados) en el servidor?')) return;
  ui.ocupado = true; dibujar();
  try {
    for (const ejemplo of alumnasDeEjemplo()) {
      if (datos.alumnas.some(a => a.dni === ejemplo.dni)) continue;
      const { registros = [], ...ficha } = ejemplo;
      const { nombre, dni, disciplina, ...extra } = ficha;
      const { id, codigo } = await servidor.crearAlumna({ nombre, dni, disciplina }, entrenadorActual(), extra);
      for (const registro of registros) await servidor.guardarRegistro(id, registro);
      datos.alumnas.push({ id, nombre, dni, disciplina, debeCambiarClave: true, codigoInicial: codigo, ...entrenadorEnFicha() });
      datos.rutinas[id] = extra.rutinas || {};
      if (extra.notaProgreso) datos.notasProgreso[id] = extra.notaProgreso;
      if (extra.evaluacion) datos.evaluaciones[id] = extra.evaluacion;
    }
    datos.alumnas.sort((a, b) => a.nombre.localeCompare(b.nombre));
    mostrarAviso('Alumnos de ejemplo cargados');
  } catch (e) { mostrarError(e); }
  ui.ocupado = false; dibujar();
}

// Cada vez que alguien entra o sale, se traen sus datos y se dibuja la pantalla que le toca
servidor.alCambiarSesion(async usuario => {
  if (dejarDeEscuchar) { dejarDeEscuchar(); dejarDeEscuchar = null; }
  avisos = []; ui.verAvisos = false; ui.editando = false; ui.eligiendoAlcance = false;
  if (!usuario) { perfil = null; cargando = false; dibujar(); return; }
  cargando = true; dibujar();
  try {
    const resultado = await servidor.cargar(usuario);
    datos = resultado.datos;
    perfil = resultado.perfil;
    ui.pestana = pestanasDe(perfil)[0][0];
    ui.alumnaId = null; ui.dia = new Date().getDay(); ui.fecha = fechaISO(); ui.estrellas = 0; ui.comentario = ''; ui.errorIngreso = '';
    // La campanita se actualiza sola mientras la app está abierta
    if (!perfil.debeCambiarClave) dejarDeEscuchar = servidor.escucharAvisos(perfil, lista => { avisos = lista; actualizarCampana(); });
  } catch (e) {
    ui.errorIngreso = mensajeError(e);
    perfil = null;
    servidor.salir();
  }
  cargando = false; dibujar();
});

dibujar();
