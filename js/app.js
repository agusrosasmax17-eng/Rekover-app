/* =========================================================
   REKOVER — Pantallas y acciones
   Cada pantalla es una función que devuelve HTML.
   Cuando algo cambia, se vuelve a dibujar todo con dibujar()
   y se guarda en el servidor (ver servidor.js).
   ========================================================= */

import * as servidor from './servidor.js';

// Copia en memoria de lo que esta persona puede ver (se trae del servidor al ingresar)
let datos = { alumnas: [], rutinas: {}, cambios: {}, registros: [], encuestas: [], notasProgreso: {}, ejerciciosPropios: {}, evaluaciones: {} };
let perfil = null;
let cargando = true; // mientras se conecta con el servidor

// Estado de la pantalla (qué pestaña está abierta, qué alumna está elegida, etc.)
const ui = {
  pestana: null,
  errorIngreso: '',         // mensaje si el usuario o la contraseña no coinciden
  errorAlumna: '',          // mensaje si no se pudo crear una alumna
  ocupado: false,           // mientras se espera una respuesta del servidor
  seccionAlumna: 'rutina',  // en la ficha de la alumna: 'rutina' o 'evaluacion'
  agregandoTest: false,     // si está abierto el formulario para sumar un test
  testElegido: TESTS[0][0], // test elegido en ese formulario ('otro' = crear uno propio)
  filtro: 'Todas',          // filtro de disciplina en la lista de alumnas
  alumnaId: null,           // alumna elegida por el profesor
  dia: new Date().getDay(), // día de la semana que edita el profesor en la rutina semanal
  modoRutina: 'semanal',    // el profesor edita la rutina 'semanal' o la de una 'fecha' puntual
  fechaRutina: fechaISO(),  // fecha puntual que está editando el profesor
  fecha: fechaISO(),        // fecha que está viendo/registrando la alumna
  agregando: false,         // si está abierta la lista para agregar ejercicios
  creando: false,           // si está abierto el formulario de ejercicio propio
  musculo: null,            // músculo elegido en esa lista
  nuevaAlumna: false,       // si está abierto el formulario de nueva alumna
  registrando: null,        // índice del ejercicio que la alumna está registrando
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

// Guarda en el servidor la ficha de una alumna (rutina, evaluación y mensaje).
// Espera medio segundo para juntar varios toques seguidos de − / + en un solo guardado.
const guardadosPendientes = {};
function guardarFicha(alumnaId) {
  clearTimeout(guardadosPendientes[alumnaId]);
  guardadosPendientes[alumnaId] = setTimeout(() => {
    delete guardadosPendientes[alumnaId];
    servidor.guardarFicha(alumnaId, {
      rutinas: datos.rutinas[alumnaId] || {},
      cambios: datos.cambios[alumnaId] || {},
      notaProgreso: datos.notasProgreso[alumnaId] || '',
      evaluacion: datos.evaluaciones[alumnaId] || null
    }).catch(mostrarError);
  }, 500);
}

// Traduce los errores del servidor a mensajes simples
function mensajeError(e) {
  const codigo = e?.code || '';
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email', 'rekover/no-existe'].includes(codigo))
    return 'El usuario o la contraseña no coinciden. Revisalos e intentá de nuevo.';
  if (codigo === 'auth/too-many-requests') return 'Hubo demasiados intentos. Esperá unos minutos y probá de nuevo.';
  if (codigo === 'auth/network-request-failed' || codigo === 'unavailable') return 'No hay conexión a internet. Revisala e intentá de nuevo.';
  if (codigo === 'rekover/sin-ficha') return 'Tu cuenta no tiene una ficha asignada. Consultá con tu profe.';
  if (codigo === 'rekover/dni-repetido') return 'Ya hay una alumna con ese DNI.';
  if (codigo === 'auth/requires-recent-login') return 'Por seguridad, salí y volvé a entrar con tu código para crear la contraseña.';
  if (codigo === 'permission-denied') return 'No tenés permiso para hacer esto.';
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
  if (perfil.rol === 'alumna') contenido = pantallaAlumna();
  if (perfil.rol === 'profesor') contenido = pantallaProfesor();
  if (perfil.rol === 'paciente') contenido = pantallaPaciente();
  app.innerHTML = encabezado() + `<section class="contenido">${contenido}</section>` + menuInferior();
}

function encabezado() {
  return `<header class="encabezado">
    ${logo(true)}
    <div class="encabezado-usuario">
      <span>${esc(perfil.nombre)}</span>
      <button class="boton-texto" data-accion="salir">Salir</button>
    </div>
  </header>`;
}

// Pestañas de abajo: cada perfil ve solo las suyas
const PESTANAS = {
  alumna:   [['hoy', 'Rutina'], ['progreso', 'Progreso'], ['encuesta', 'Encuesta']],
  profesor: [['alumnas', 'Alumnas'], ['encuestas', 'Encuestas'], ['kinesio', 'Kinesio']],
  paciente: [['turnos', 'Turnos']]
};

function menuInferior() {
  const lista = PESTANAS[perfil.rol];
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
    <form class="form-ingreso" data-form="ingreso" autocomplete="on">
      <label class="campo">Usuario o DNI
        <input name="usuario" required autocomplete="username" autocapitalize="none" placeholder="Tu usuario o tu DNI sin puntos">
      </label>
      <label class="campo">Contraseña
        <input name="clave" type="password" autocomplete="current-password" placeholder="Tu contraseña">
      </label>
      <p class="nota-chica">¿Es tu primera vez? Escribí tu DNI y, como contraseña, el código de 8 números que te dio tu profe.</p>
      ${ui.errorIngreso ? `<p class="error">${esc(ui.errorIngreso)}</p>` : ''}
      <button type="submit" class="boton ancho" ${ui.ocupado ? 'disabled' : ''}>${ui.ocupado ? 'Ingresando…' : 'Ingresar'}</button>
    </form>
  </section>`;
}

// Primer ingreso de una alumna: crea su propia contraseña
function pantallaCrearClave() {
  const alumna = alumnaPorId(perfil.alumnaId);
  return `<section class="ingreso">
    ${logo(false)}
    <p class="ingreso-bajada">Sports Recovery</p>
    <h1>Hola, ${esc(alumna.nombre.split(' ')[0])}</h1>
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

  const tarjetas = rutina.map((ej, i) => {
    const hecho = datos.registros.find(r => r.alumnaId === alumna.id && r.nombre === ej.nombre && r.fecha === fecha);
    const abierto = ui.registrando === i;
    const base = hecho || ej; // si ya registró, se muestra lo que hizo
    return `<article class="tarjeta ejercicio ${hecho ? 'hecho' : ''}">
      <div class="ejercicio-titulo">
        <div><small class="musculo">${esc(ej.musculo)}</small><h3>${esc(ej.nombre)}</h3></div>
        ${hecho ? '<span class="check">✓</span>' : ''}
      </div>
      <div class="datos-ejercicio">
        <div><b>${ej.series}</b><small>series</small></div>
        <div><b>${ej.reps}</b><small>reps</small></div>
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

  return `<h1>${esHoy ? 'Mi rutina de hoy' : 'Rutina del ' + fechaLarga(fecha)}</h1>
    <p class="suave">${esc(alumna.disciplina)}</p>
    ${selectorFecha('fecha-alumna', fecha, 'Elegí el día que querés ver o anotar')}
    ${especial ? '<p class="aviso-especial">Rutina especial para este día, armada por tu profe.</p>' : ''}
    ${rutina.length ? tarjetas : `<div class="tarjeta vacio">${esHoy ? 'Hoy no tenés rutina: día de recuperación. Mañana seguimos.' : 'No hay rutina para este día.'}</div>`}
    ${esFutura && rutina.length ? '<p class="suave centro">Este día todavía no llegó: vas a poder anotar lo que hiciste cuando llegue.</p>' : ''}`;
}

function alumnaProgreso() {
  const alumnaId = perfil.alumnaId;
  const propios = datos.registros.filter(r => r.alumnaId === alumnaId);
  const nombres = [...new Set(propios.map(r => r.nombre))];
  const nota = datos.notasProgreso[alumnaId];
  const mensajeProfe = (nota ? `<div class="tarjeta nota-profe"><h3>Mensaje de tu profe</h3><p>${esc(nota)}</p></div>` : '')
    + evaluacionDeAlumna(alumnaId);
  if (!nombres.length) return `<h1>Mi progreso</h1><div class="tarjeta vacio">Todavía no registraste ejercicios.</div>${mensajeProfe}`;
  if (!nombres.includes(ui.ejercicioGrafico)) ui.ejercicioGrafico = nombres[0];

  const puntos = propios.filter(r => r.nombre === ui.ejercicioGrafico).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const mejorPeso = Math.max(...puntos.map(p => p.peso));
  const mejorReps = Math.max(...puntos.map(p => p.reps));
  const aumento = puntos[puntos.length - 1].peso - puntos[0].peso;

  return `<h1>Mi progreso</h1>
    <label class="campo">Ejercicio
      <select data-cambio="ejercicio-grafico">
        ${nombres.map(n => `<option ${n === ui.ejercicioGrafico ? 'selected' : ''}>${esc(n)}</option>`).join('')}
      </select>
    </label>
    <div class="resumen">
      <div class="tarjeta"><b>${formatoPeso(mejorPeso)}</b><small>Mejor peso</small></div>
      <div class="tarjeta"><b>${mejorReps}</b><small>Máx. repeticiones</small></div>
      <div class="tarjeta"><b class="${aumento > 0 ? 'oro' : ''}">${aumento > 0 ? '+' : ''}${numero(aumento)} kg</b><small>Aumento desde el inicio</small></div>
    </div>
    <div class="tarjeta">
      <h3>Peso (kg)</h3>
      ${grafico(puntos.map(p => ({ fecha: p.fecha, valor: p.peso })), 'var(--azul)')}
    </div>
    <div class="tarjeta significado">
      <h3>Qué significa tu progreso</h3>
      <p>${significadoProgreso(puntos, mejorPeso, mejorReps)}</p>
    </div>
    ${mensajeProfe}`;
}

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

// Explica el progreso en palabras simples, con los números reales
function significadoProgreso(puntos, mejorPeso, mejorReps) {
  const nombre = esc(ui.ejercicioGrafico);
  const primero = puntos[0], ultimo = puntos[puntos.length - 1];
  if (puntos.length < 2) return `Tenés un solo registro de ${nombre}. Con dos o más vas a ver cuánto avanzaste.`;
  if (mejorPeso === 0) return `${nombre} se hace sin peso. Llegaste a ${mejorReps} repeticiones en una serie.`;
  const dias = (new Date(ultimo.fecha) - new Date(primero.fecha)) / 864e5;
  const semanas = Math.max(1, Math.round(dias / 7));
  const tiempo = semanas === 1 ? '1 semana' : `${semanas} semanas`;
  const diferencia = ultimo.peso - primero.peso;
  if (diferencia > 0) {
    const porcentaje = primero.peso > 0 ? ` (un ${Math.round(diferencia / primero.peso * 100)}% más)` : '';
    return `En ${tiempo} pasaste de ${formatoPeso(primero.peso)} a ${formatoPeso(ultimo.peso)} en ${nombre}: levantás ${numero(diferencia)} kg más${porcentaje}. Tu mejor marca es ${formatoPeso(mejorPeso)} y llegaste a ${mejorReps} repeticiones en una serie.`;
  }
  if (diferencia === 0) return `Hace ${tiempo} que trabajás con ${formatoPeso(ultimo.peso)} en ${nombre}. Cuando completes todas las repeticiones con buena técnica, es momento de hablar con tu profe para subir el peso.`;
  return `Hoy usás ${numero(-diferencia)} kg menos que al inicio en ${nombre}. Puede ser parte del plan (técnica o recuperación): consultalo con tu profe.`;
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
  const circulos = puntos.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.valor)}" r="3.5" fill="${color}"><title>${formatoFecha(p.fecha)}: ${numero(p.valor)} kg</title></circle>`).join('');
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
  if (ui.pestana === 'encuestas') return profesorEncuestas();
  if (ui.pestana === 'kinesio') return proximamente('Kinesiología', 'Acá vas a agregar turnos y registrar cada sesión: evaluación, protocolo y resultado.');
  return ui.alumnaId ? profesorFichaAlumna() : profesorAlumnas();
}

function profesorAlumnas() {
  const filtros = ['Todas', ...DISCIPLINAS, ...DISCIPLINAS_PROXIMAMENTE];
  const chips = `<div class="chips">${filtros.map(d =>
    `<button class="chip ${ui.filtro === d ? 'activa' : ''}" data-accion="filtro" data-valor="${d}">${d}</button>`).join('')}
  </div>`;
  const encabezadoLista = `<h1>Gimnasio</h1><p class="suave">Paso 1: elegí la alumna para armar su rutina.</p>${chips}`;

  if (DISCIPLINAS_PROXIMAMENTE.includes(ui.filtro)) {
    return encabezadoLista + `<div class="tarjeta vacio"><span class="etiqueta-oro">Próximamente</span><p>${ui.filtro} se suma en una próxima versión de la app.</p></div>`;
  }

  const lista = datos.alumnas.filter(a => ui.filtro === 'Todas' || a.disciplina === ui.filtro);
  return encabezadoLista + `
    ${lista.map(a => {
      const dias = Object.keys(datos.rutinas[a.id] || {}).filter(d => datos.rutinas[a.id][d].length).length;
      return `<button class="tarjeta fila-alumna" data-accion="elegir-alumna" data-valor="${a.id}">
        <span class="perfil-inicial">${esc(a.nombre[0])}</span>
        <span class="crece"><strong>${esc(a.nombre)}</strong><small>${esc(a.disciplina)} · ${dias} ${dias === 1 ? 'día' : 'días'} con rutina</small>
          ${a.debeCambiarClave ? '<em class="etiqueta-propio">Falta su primer ingreso</em>' : ''}</span>
        <span class="flecha">›</span>
      </button>`;
    }).join('') || (datos.alumnas.length ? '<div class="tarjeta vacio">No hay alumnas en esta disciplina.</div>'
      : `<div class="tarjeta vacio"><p>Todavía no cargaste alumnas.</p>
          <button class="boton secundario" data-accion="cargar-ejemplo" ${ui.ocupado ? 'disabled' : ''}>${ui.ocupado ? 'Cargando…' : 'Cargar 3 alumnas de ejemplo para probar'}</button></div>`)}
    ${ui.nuevaAlumna ? `
      <form class="tarjeta" data-form="nueva-alumna">
        <h3>Nueva alumna</h3>
        <label class="campo">Nombre y apellido<input name="nombre" required maxlength="40" placeholder="Ej.: Ana Torres"></label>
        <label class="campo">DNI (sin puntos) — es su usuario para ingresar
          <input name="dni" required inputmode="numeric" pattern="[0-9]{7,8}" maxlength="8" placeholder="Ej.: 35123456"></label>
        <p class="nota-chica">La app genera un código de primer ingreso. Ella entra con su DNI y ese código, y crea su propia contraseña.</p>
        <label class="campo">Disciplina
          <select name="disciplina">${DISCIPLINAS.map(d => `<option>${d}</option>`).join('')}</select>
        </label>
        ${ui.errorAlumna ? `<p class="error">${esc(ui.errorAlumna)}</p>` : ''}
        <div class="fila-botones">
          <button type="button" class="boton secundario" data-accion="cerrar-nueva-alumna">Cancelar</button>
          <button type="submit" class="boton" ${ui.ocupado ? 'disabled' : ''}>${ui.ocupado ? 'Creando…' : 'Agregar'}</button>
        </div>
      </form>`
    : '<button class="boton secundario ancho" data-accion="abrir-nueva-alumna">+ Nueva alumna</button>'}`;
}

// Ficha de una alumna: datos de su cuenta y pestañas Rutina / Evaluación inicial
function profesorFichaAlumna() {
  const alumna = alumnaPorId(ui.alumnaId);
  const secciones = [['rutina', 'Rutina'], ['evaluacion', 'Evaluación inicial']];
  return `<button class="boton-texto volver" data-accion="volver">‹ Alumnas</button>
    <h1>${esc(alumna.nombre)}</h1>
    <p class="suave">${esc(alumna.disciplina)} · DNI ${esc(alumna.dni)}</p>
    ${alumna.debeCambiarClave ? `
      <div class="tarjeta codigo-ingreso">
        <small>Código de primer ingreso</small>
        <b>${esc(alumna.codigoInicial)}</b>
        <p>Pasáselo a ${esc(alumna.nombre.split(' ')[0])}: entra con su DNI y este código, y crea su propia contraseña.</p>
      </div>` : ''}
    <div class="cuenta">
      <span>${alumna.debeCambiarClave ? 'Todavía no creó su contraseña.' : 'Contraseña creada por ella.'}</span>
      <button class="boton-texto" data-accion="restablecer-clave" ${ui.ocupado ? 'disabled' : ''}>${alumna.debeCambiarClave ? 'Generar otro código' : 'Restablecer'}</button>
    </div>
    <div class="pestanas-internas">${secciones.map(([id, texto]) =>
      `<button class="${ui.seccionAlumna === id ? 'activa' : ''}" data-accion="seccion-alumna" data-valor="${id}">${texto}</button>`).join('')}
    </div>
    ${ui.seccionAlumna === 'evaluacion' ? profesorEvaluacion(alumna) : profesorRutina(alumna)}`;
}

function profesorRutina(alumna) {
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
  const rutina = rutinaEditable(alumna.id);

  const items = rutina.map((ej, i) => `
    <article class="tarjeta ejercicio">
      <div class="ejercicio-titulo">
        <div><small class="musculo">${esc(ej.musculo)}</small><h3>${esc(ej.nombre)}</h3></div>
        <button class="boton-icono" data-accion="quitar" data-valor="${i}" aria-label="Quitar ejercicio">✕</button>
      </div>
      <div class="ajustes">
        ${ajuste(i, 'series', 'Series', ej.series)}
        ${ajuste(i, 'reps', 'Reps', ej.reps)}
        ${ajuste(i, 'peso', 'Peso', formatoPeso(ej.peso))}
        ${ajuste(i, 'pausa', 'Pausa', formatoPausa(ej.pausa))}
      </div>
    </article>`).join('');

  return elegirModo + encabezado + `
    ${items || '<div class="tarjeta vacio">Este día no tiene ejercicios todavía.</div>'}
    ${ui.agregando ? selectorEjercicios(alumna) : '<button class="boton ancho" data-accion="abrir-agregar">+ Agregar ejercicio</button>'}
    ${notaProgreso(alumna)}`;
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
  const yaEstan = rutinaEditable(alumna.id).map(e => e.nombre);
  return `<div class="tarjeta selector">
    <div class="fila-separada"><h3>Agregar ejercicio</h3>
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
          <button type="submit" class="boton">Crear y agregar</button>
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
  if (['pestana', 'elegir-alumna', 'volver', 'seccion-alumna'].includes(b.dataset.accion)) window.scrollTo(0, 0);

  switch (b.dataset.accion) {
    case 'salir':
      ui.errorIngreso = '';
      servidor.salir(); // al cerrar la sesión, alCambiarSesion vuelve a la pantalla de ingreso
      return;
    case 'cargar-ejemplo': cargarEjemplo(); return;
    case 'pestana':
      ui.pestana = v; ui.alumnaId = null; ui.agregando = false; ui.creando = false; ui.registrando = null;
      ui.dia = new Date().getDay(); ui.fecha = fechaISO(); ui.estrellas = 0; ui.comentario = '';
      break;
    case 'dia':
      ui.dia = Number(v); ui.registrando = null;
      break;
    case 'fecha-alumna': ui.fecha = v; ui.registrando = null; break;
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
    // Alumna
    case 'registrar': ui.registrando = Number(v); break;
    case 'cancelar-registro': ui.registrando = null; break;
    case 'estrella': ui.estrellas = Number(v); break;
    // Profesor
    case 'filtro': ui.filtro = v; ui.nuevaAlumna = false; break;
    case 'elegir-alumna':
      ui.alumnaId = v; ui.agregando = false; ui.creando = false;
      ui.seccionAlumna = 'rutina'; ui.agregandoTest = false;
      ui.dia = new Date().getDay(); ui.modoRutina = 'semanal'; ui.fechaRutina = fechaISO();
      break;
    case 'volver': ui.alumnaId = null; ui.agregando = false; ui.creando = false; break;
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
      guardarFicha(ui.alumnaId);
      break;
    case 'abrir-nueva-alumna': ui.nuevaAlumna = true; ui.errorAlumna = ''; break;
    case 'cerrar-nueva-alumna': ui.nuevaAlumna = false; break;
    case 'abrir-agregar': ui.agregando = true; break;
    case 'cerrar-agregar': ui.agregando = false; ui.creando = false; break;
    case 'abrir-crear': ui.creando = true; break;
    case 'cerrar-crear': ui.creando = false; break;
    case 'musculo': ui.musculo = v; ui.creando = false; break;
    case 'agregar': {
      const alumna = alumnaPorId(ui.alumnaId);
      rutinaEditable(alumna.id).push(itemRutina(alumna.disciplina, v, 3, 10, Number(b.dataset.peso), 60, ui.musculo));
      guardarFicha(alumna.id); mostrarAviso('Ejercicio agregado'); return;
    }
    case 'quitar':
      rutinaEditable(ui.alumnaId).splice(Number(v), 1);
      guardarFicha(ui.alumnaId);
      break;
    case 'paso': {
      const ej = rutinaEditable(ui.alumnaId)[Number(b.dataset.indice)];
      const campo = b.dataset.campo;
      ej[campo] = Math.max(MINIMOS[campo], ej[campo] + Number(b.dataset.delta) * PASOS[campo]);
      guardarFicha(ui.alumnaId);
      break;
    }
  }
  dibujar();
});

app.addEventListener('change', ev => {
  const cambio = ev.target.dataset.cambio;
  if (cambio === 'ejercicio-grafico') { ui.ejercicioGrafico = ev.target.value; dibujar(); }
  if (cambio === 'fecha-alumna' && ev.target.value) { ui.fecha = ev.target.value; ui.registrando = null; dibujar(); }
  if (cambio === 'fecha-rutina' && ev.target.value) { ui.fechaRutina = ev.target.value; ui.agregando = false; dibujar(); }
  if (cambio === 'tipo-test') { ui.testElegido = ev.target.value; dibujar(); }
  if (cambio === 'test-resultado') {
    const test = datos.evaluaciones[ui.alumnaId].tests[Number(ev.target.dataset.indice)];
    test.resultado = Math.max(0, Number(ev.target.value) || 0);
    guardarFicha(ui.alumnaId); mostrarAviso('Resultado guardado');
  }
});

// Devuelve la evaluación de la alumna elegida (la crea vacía si no existe)
function evaluacionActual() {
  return datos.evaluaciones[ui.alumnaId] || (datos.evaluaciones[ui.alumnaId] = { fecha: fechaISO(), tests: [] });
}

app.addEventListener('input', ev => {
  if (ev.target.name === 'comentario') ui.comentario = ev.target.value;
});

app.addEventListener('submit', ev => {
  ev.preventDefault();
  const f = ev.target;
  const campos = new FormData(f);
  const num = (nombre, min) => Math.max(min, Number(campos.get(nombre)) || 0);

  if (f.dataset.form === 'ingreso') {
    ui.errorIngreso = ''; ui.ocupado = true; dibujar();
    // Si los datos coinciden, alCambiarSesion se encarga de traer los datos y mostrar la app
    servidor.ingresar(String(campos.get('usuario')), String(campos.get('clave')))
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
      servidor.cambiarClave(perfil.alumnaId, clave)
        .then(() => { perfil.debeCambiarClave = false; mostrarAviso('Contraseña creada. ¡Bienvenida!'); })
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
    datos.registros.push(registro);
    ui.registrando = null;
    mostrarAviso('Registro guardado. Sumaste progreso');
    servidor.guardarRegistro(perfil.alumnaId, registro).catch(mostrarError);
  }

  if (f.dataset.form === 'encuesta') {
    if (!ui.estrellas) return;
    const respuesta = { area: f.dataset.area, autor: perfil.nombre, alumnaId: perfil.alumnaId, fecha: fechaISO(), puntaje: ui.estrellas, comentario: String(campos.get('comentario') || '').trim().slice(0, 300) };
    datos.encuestas.push(respuesta);
    ui.estrellas = 0; ui.comentario = '';
    mostrarAviso('Gracias. Tu respuesta ya llegó');
    servidor.agregarEncuesta(respuesta).catch(mostrarError);
  }

  if (f.dataset.form === 'nueva-alumna') {
    const nombre = String(campos.get('nombre') || '').trim();
    const dni = String(campos.get('dni') || '').replace(/\D/g, '');
    if (!nombre || !dni) return;
    if (datos.alumnas.some(a => a.dni === dni)) { ui.errorAlumna = 'Ya hay una alumna con ese DNI.'; dibujar(); return; }
    const disciplina = String(campos.get('disciplina'));
    ui.ocupado = true; ui.errorAlumna = ''; dibujar();
    // Se crea con un código de primer ingreso; ella después crea su contraseña
    servidor.crearAlumna({ nombre, dni, disciplina })
      .then(({ id, codigo }) => {
        datos.alumnas.push({ id, nombre, dni, disciplina, debeCambiarClave: true, codigoInicial: codigo });
        datos.alumnas.sort((a, b) => a.nombre.localeCompare(b.nombre));
        datos.rutinas[id] = {};
        ui.nuevaAlumna = false;
        // Abre su ficha, donde se ve el código para pasárselo
        ui.alumnaId = id; ui.seccionAlumna = 'rutina'; ui.dia = new Date().getDay();
        window.scrollTo(0, 0);
        mostrarAviso('Alumna creada');
      })
      .catch(e => { ui.errorAlumna = mensajeError(e); })
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
    if (!ejerciciosDe(alumna.disciplina, ui.musculo).some(e => e[0].toLowerCase() === nombre.toLowerCase())) {
      lista.push({ nombre, peso });
      servidor.guardarEjerciciosPropios(datos.ejerciciosPropios).catch(mostrarError);
    }
    rutinaEditable(alumna.id).push(itemRutina(alumna.disciplina, nombre, 3, 10, peso, 60, ui.musculo));
    ui.creando = false;
    guardarFicha(alumna.id); mostrarAviso('Ejercicio creado y agregado');
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
    guardarFicha(ui.alumnaId); mostrarAviso('Evaluación guardada');
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
    guardarFicha(ui.alumnaId); mostrarAviso('Test agregado');
  }

  if (f.dataset.form === 'nota') {
    const nota = String(campos.get('nota') || '').trim().slice(0, 400);
    if (nota) datos.notasProgreso[ui.alumnaId] = nota;
    else delete datos.notasProgreso[ui.alumnaId];
    guardarFicha(ui.alumnaId); mostrarAviso('Mensaje guardado');
  }
});

// Carga en el servidor las alumnas de ejemplo (cada una con su código de primer ingreso)
async function cargarEjemplo() {
  if (!confirm('¿Cargar 3 alumnas de ejemplo (datos inventados) en el servidor?')) return;
  ui.ocupado = true; dibujar();
  try {
    for (const ejemplo of alumnasDeEjemplo()) {
      if (datos.alumnas.some(a => a.dni === ejemplo.dni)) continue;
      const { registros = [], ...ficha } = ejemplo;
      const { nombre, dni, disciplina, ...extra } = ficha;
      const { id, codigo } = await servidor.crearAlumna({ nombre, dni, disciplina }, extra);
      for (const registro of registros) await servidor.guardarRegistro(id, registro);
      datos.alumnas.push({ id, nombre, dni, disciplina, debeCambiarClave: true, codigoInicial: codigo });
      datos.rutinas[id] = extra.rutinas || {};
      if (extra.notaProgreso) datos.notasProgreso[id] = extra.notaProgreso;
      if (extra.evaluacion) datos.evaluaciones[id] = extra.evaluacion;
    }
    datos.alumnas.sort((a, b) => a.nombre.localeCompare(b.nombre));
    mostrarAviso('Alumnas de ejemplo cargadas');
  } catch (e) { mostrarError(e); }
  ui.ocupado = false; dibujar();
}

// Cada vez que alguien entra o sale, se traen sus datos y se dibuja la pantalla que le toca
servidor.alCambiarSesion(async usuario => {
  if (!usuario) { perfil = null; cargando = false; dibujar(); return; }
  cargando = true; dibujar();
  try {
    const resultado = await servidor.cargar(usuario);
    datos = resultado.datos;
    perfil = resultado.perfil;
    ui.pestana = PESTANAS[perfil.rol][0][0];
    ui.alumnaId = null; ui.dia = new Date().getDay(); ui.fecha = fechaISO(); ui.estrellas = 0; ui.comentario = ''; ui.errorIngreso = '';
  } catch (e) {
    ui.errorIngreso = mensajeError(e);
    perfil = null;
    servidor.salir();
  }
  cargando = false; dibujar();
});

dibujar();
