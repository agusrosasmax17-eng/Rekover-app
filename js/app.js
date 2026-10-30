/* =========================================================
   REKOVER — Pantallas y acciones
   Cada pantalla es una función que devuelve HTML.
   Cuando algo cambia, se vuelve a dibujar todo con dibujar().
   ========================================================= */

let datos = cargarDatos();
let perfil = PERFILES.find(p => p.id === cargarSesion()) || null;

// Estado de la pantalla (qué pestaña está abierta, qué alumna está elegida, etc.)
const ui = {
  pestana: null,
  filtro: 'Todas',          // filtro de disciplina en la lista de alumnas
  alumnaId: null,           // alumna elegida por el profesor
  dia: new Date().getDay(), // día de la rutina que se está viendo
  agregando: false,         // si está abierta la lista para agregar ejercicios
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

function guardar() { guardarDatos(datos); }

// Muestra un mensajito abajo por un par de segundos ("Guardado", etc.)
function mostrarAviso(texto) {
  dibujar();
  const aviso = document.getElementById('aviso');
  aviso.textContent = texto;
  aviso.classList.add('visible');
  clearTimeout(mostrarAviso.t);
  mostrarAviso.t = setTimeout(() => aviso.classList.remove('visible'), 1800);
}

function formatoPausa(seg) {
  const m = Math.floor(seg / 60), s = seg % 60;
  return m ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

function formatoPeso(kg) { return kg > 0 ? `${String(kg).replace('.', ',')} kg` : 'Sin peso'; }

function formatoFecha(iso) { const [, m, d] = iso.split('-'); return `${d}/${m}`; }

function alumnaPorId(id) { return datos.alumnas.find(a => a.id === id); }

function rutinaDe(alumnaId, dia) {
  const r = datos.rutinas[alumnaId] || (datos.rutinas[alumnaId] = {});
  return r[dia] || (r[dia] = []);
}

// Isologotipo (K + texto): según el manual de marca, es la variante principal.
// Se usa siempre sobre fondo navy, sin estirarlo ni agregarle efectos.
function logo(chico) {
  return `<img class="logo ${chico ? 'logo-chico' : ''}" src="img/rekover_isologotipo.png" alt="Rekover">`;
}

/* ---------- Dibujo general ---------- */

function dibujar() {
  if (!perfil) { app.innerHTML = pantallaIngreso(); return; }
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
  alumna:   [['hoy', 'Hoy'], ['progreso', 'Progreso'], ['encuesta', 'Encuesta']],
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
    <p class="ingreso-lema">Recuperación y rendimiento, con protocolo. Volvé a la cancha.</p>
    <h1>Ingresar</h1>
    <p class="suave">Elegí un perfil de prueba:</p>
    <div class="lista-perfiles">
      ${PERFILES.map(p => `
        <button class="tarjeta perfil" data-accion="ingresar" data-valor="${p.id}">
          <span class="perfil-inicial">${p.nombre[0]}</span>
          <span><strong>${esc(p.nombre)}</strong><small>${esc(p.detalle)}</small></span>
        </button>`).join('')}
    </div>
    <button class="boton-texto reiniciar" data-accion="reiniciar">Volver a los datos de ejemplo</button>
  </section>`;
}

/* ---------- Selector de días (compartido) ---------- */

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
  const rutina = rutinaDe(alumna.id, ui.dia);
  const hoy = fechaISO();
  const esHoy = ui.dia === new Date().getDay();

  const tarjetas = rutina.map((ej, i) => {
    const hecho = datos.registros.find(r => r.alumnaId === alumna.id && r.nombre === ej.nombre && r.fecha === hoy);
    const abierto = ui.registrando === i;
    return `<article class="tarjeta ejercicio ${hecho && esHoy ? 'hecho' : ''}">
      <div class="ejercicio-titulo">
        <div><small class="musculo">${esc(ej.musculo)}</small><h3>${esc(ej.nombre)}</h3></div>
        ${hecho && esHoy ? '<span class="check">✓</span>' : ''}
      </div>
      <div class="datos-ejercicio">
        <div><b>${ej.series}</b><small>series</small></div>
        <div><b>${ej.reps}</b><small>reps</small></div>
        <div><b>${formatoPeso(ej.peso)}</b><small>peso</small></div>
        <div><b>${formatoPausa(ej.pausa)}</b><small>pausa</small></div>
      </div>
      ${!esHoy ? '' : abierto ? `
        <form class="registro" data-form="registro" data-indice="${i}">
          <label>Peso que usé (kg)<input type="number" name="peso" step="0.5" min="0" inputmode="decimal" value="${hecho ? hecho.peso : ej.peso}"></label>
          <label>Repeticiones que hice<input type="number" name="reps" step="1" min="0" inputmode="numeric" value="${hecho ? hecho.reps : ej.reps}"></label>
          <div class="fila-botones">
            <button type="button" class="boton secundario" data-accion="cancelar-registro">Cancelar</button>
            <button type="submit" class="boton">Guardar</button>
          </div>
        </form>`
      : `<button class="boton ${hecho ? 'secundario' : ''} ancho" data-accion="registrar" data-valor="${i}">
          ${hecho ? `Hecho: ${formatoPeso(hecho.peso)} × ${hecho.reps} · Cambiar` : 'Registrar lo que hice'}</button>`}
    </article>`;
  }).join('');

  return `<h1>${esHoy ? 'Mi rutina de hoy' : 'Rutina del ' + DIAS[ui.dia].toLowerCase()}</h1>
    <p class="suave">${esc(alumna.disciplina)} · ${DIAS[ui.dia]}</p>
    ${selectorDias(alumna.id)}
    ${rutina.length ? tarjetas : `<div class="tarjeta vacio">${esHoy ? 'Hoy no tenés rutina: día de recuperación. Mañana seguimos.' : 'No hay rutina para este día.'}</div>`}
    ${!esHoy && rutina.length ? '<p class="suave centro">Podés registrar lo que hiciste solo en la rutina de hoy.</p>' : ''}`;
}

function alumnaProgreso() {
  const alumnaId = perfil.alumnaId;
  const propios = datos.registros.filter(r => r.alumnaId === alumnaId);
  const nombres = [...new Set(propios.map(r => r.nombre))];
  if (!nombres.length) return `<h1>Mi progreso</h1><div class="tarjeta vacio">Todavía no registraste ejercicios.</div>`;
  if (!nombres.includes(ui.ejercicioGrafico)) ui.ejercicioGrafico = nombres[0];

  const puntos = propios.filter(r => r.nombre === ui.ejercicioGrafico).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const mejorPeso = Math.max(...puntos.map(p => p.peso));
  const mejorReps = Math.max(...puntos.map(p => p.reps));
  const diferencia = puntos.length > 1 ? puntos[puntos.length - 1].peso - puntos[0].peso : 0;

  return `<h1>Mi progreso</h1>
    <label class="campo">Ejercicio
      <select data-cambio="ejercicio-grafico">
        ${nombres.map(n => `<option ${n === ui.ejercicioGrafico ? 'selected' : ''}>${esc(n)}</option>`).join('')}
      </select>
    </label>
    <div class="resumen">
      <div class="tarjeta"><b>${formatoPeso(mejorPeso)}</b><small>Mejor peso</small></div>
      <div class="tarjeta"><b>${mejorReps}</b><small>Más reps</small></div>
      <div class="tarjeta"><b class="${diferencia > 0 ? 'oro' : ''}">${diferencia > 0 ? '+' : ''}${String(diferencia).replace('.', ',')} kg</b><small>Desde el inicio</small></div>
    </div>
    <div class="tarjeta">
      <h3>Peso (kg)</h3>
      ${grafico(puntos.map(p => ({ fecha: p.fecha, valor: p.peso })), 'var(--azul)')}
    </div>
    <div class="tarjeta">
      <h3>Repeticiones</h3>
      ${grafico(puntos.map(p => ({ fecha: p.fecha, valor: p.reps })), 'var(--oro)')}
    </div>
    <p class="suave centro">Progreso con números reales: los gráficos usan lo que registrás en "Hoy".</p>`;
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
  const guias = [max, (max + min) / 2, min].map(v => {
    const t = Math.round(v * 10) / 10;
    return `<line x1="${iz}" x2="${W - de}" y1="${y(v)}" y2="${y(v)}" class="guia"/>
      <text x="${iz - 6}" y="${y(v) + 4}" text-anchor="end">${String(t).replace('.', ',')}</text>`;
  }).join('');
  const etiquetas = puntos.map((p, i) => (i === 0 || i === puntos.length - 1 || puntos.length <= 5)
    ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${formatoFecha(p.fecha)}</text>` : '').join('');
  const circulos = puntos.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.valor)}" r="3.5" fill="${color}"><title>${formatoFecha(p.fecha)}: ${p.valor}</title></circle>`).join('');
  return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de progreso">
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
  return ui.alumnaId ? profesorRutina() : profesorAlumnas();
}

function profesorAlumnas() {
  const lista = datos.alumnas.filter(a => ui.filtro === 'Todas' || a.disciplina === ui.filtro);
  return `<h1>Gimnasio</h1>
    <p class="suave">Paso 1: elegí la alumna para armar su rutina.</p>
    <div class="chips">${['Todas', ...DISCIPLINAS].map(d =>
      `<button class="chip ${ui.filtro === d ? 'activa' : ''}" data-accion="filtro" data-valor="${d}">${d}</button>`).join('')}
    </div>
    ${lista.map(a => {
      const dias = Object.keys(datos.rutinas[a.id] || {}).filter(d => datos.rutinas[a.id][d].length).length;
      return `<button class="tarjeta fila-alumna" data-accion="elegir-alumna" data-valor="${a.id}">
        <span class="perfil-inicial">${esc(a.nombre[0])}</span>
        <span class="crece"><strong>${esc(a.nombre)}</strong><small>${esc(a.disciplina)} · ${dias} ${dias === 1 ? 'día' : 'días'} con rutina</small></span>
        <span class="flecha">›</span>
      </button>`;
    }).join('') || '<div class="tarjeta vacio">No hay alumnas en esta disciplina.</div>'}
    ${ui.nuevaAlumna ? `
      <form class="tarjeta" data-form="nueva-alumna">
        <h3>Nueva alumna</h3>
        <label class="campo">Nombre y apellido<input name="nombre" required maxlength="40" placeholder="Ej.: Ana Torres"></label>
        <label class="campo">Disciplina
          <select name="disciplina">${DISCIPLINAS.map(d => `<option>${d}</option>`).join('')}</select>
        </label>
        <div class="fila-botones">
          <button type="button" class="boton secundario" data-accion="cerrar-nueva-alumna">Cancelar</button>
          <button type="submit" class="boton">Agregar</button>
        </div>
      </form>`
    : '<button class="boton secundario ancho" data-accion="abrir-nueva-alumna">+ Nueva alumna</button>'}`;
}

function profesorRutina() {
  const alumna = alumnaPorId(ui.alumnaId);
  const rutina = rutinaDe(alumna.id, ui.dia);

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

  return `<button class="boton-texto volver" data-accion="volver">‹ Alumnas</button>
    <h1>${esc(alumna.nombre)}</h1>
    <p class="suave">${esc(alumna.disciplina)} · Paso 2: elegí el día y armá la rutina.</p>
    ${selectorDias(alumna.id)}
    <h2>${DIAS[ui.dia]}</h2>
    ${items || '<div class="tarjeta vacio">Este día no tiene ejercicios todavía.</div>'}
    ${ui.agregando ? selectorEjercicios(alumna) : '<button class="boton ancho" data-accion="abrir-agregar">+ Agregar ejercicio</button>'}`;
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
  const grupos = CATALOGO[alumna.disciplina];
  const musculos = Object.keys(grupos);
  if (!musculos.includes(ui.musculo)) ui.musculo = musculos[0];
  const yaEstan = rutinaDe(alumna.id, ui.dia).map(e => e.nombre);
  return `<div class="tarjeta selector">
    <div class="fila-separada"><h3>Agregar ejercicio</h3>
      <button class="boton-icono" data-accion="cerrar-agregar" aria-label="Cerrar">✕</button></div>
    <div class="chips">${musculos.map(m =>
      `<button class="chip ${ui.musculo === m ? 'activa' : ''}" data-accion="musculo" data-valor="${esc(m)}">${esc(m)}</button>`).join('')}
    </div>
    <div class="lista-ejercicios">${grupos[ui.musculo].map(([nombre, peso]) => {
      const esta = yaEstan.includes(nombre);
      return `<button class="opcion ${esta ? 'agregado' : ''}" data-accion="agregar" data-valor="${esc(nombre)}" ${esta ? 'disabled' : ''}>
        <span>${esc(nombre)}</span><small>${esta ? 'Ya está' : formatoPeso(peso) + ' · +'}</small></button>`;
    }).join('')}</div>
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

  switch (b.dataset.accion) {
    case 'ingresar':
      perfil = PERFILES.find(p => p.id === v);
      guardarSesion(perfil.id);
      ui.pestana = PESTANAS[perfil.rol][0][0];
      ui.alumnaId = null; ui.dia = new Date().getDay(); ui.estrellas = 0;
      break;
    case 'salir':
      perfil = null; guardarSesion(null);
      break;
    case 'reiniciar':
      if (!confirm('¿Borrar los cambios y volver a los datos de ejemplo?')) return;
      borrarDatos(); datos = cargarDatos();
      mostrarAviso('Datos de ejemplo restaurados'); return;
    case 'pestana':
      ui.pestana = v; ui.alumnaId = null; ui.agregando = false; ui.registrando = null;
      ui.dia = new Date().getDay(); ui.estrellas = 0; ui.comentario = '';
      break;
    case 'dia':
      ui.dia = Number(v); ui.registrando = null;
      break;
    // Alumna
    case 'registrar': ui.registrando = Number(v); break;
    case 'cancelar-registro': ui.registrando = null; break;
    case 'estrella': ui.estrellas = Number(v); break;
    // Profesor
    case 'filtro': ui.filtro = v; break;
    case 'elegir-alumna':
      ui.alumnaId = v; ui.agregando = false;
      ui.dia = new Date().getDay();
      break;
    case 'volver': ui.alumnaId = null; ui.agregando = false; break;
    case 'abrir-nueva-alumna': ui.nuevaAlumna = true; break;
    case 'cerrar-nueva-alumna': ui.nuevaAlumna = false; break;
    case 'abrir-agregar': ui.agregando = true; break;
    case 'cerrar-agregar': ui.agregando = false; break;
    case 'musculo': ui.musculo = v; break;
    case 'agregar': {
      const alumna = alumnaPorId(ui.alumnaId);
      const ej = CATALOGO[alumna.disciplina][ui.musculo].find(e => e[0] === v);
      rutinaDe(alumna.id, ui.dia).push(itemRutina(alumna.disciplina, ej[0], 3, 10, ej[1], 60));
      guardar(); mostrarAviso('Ejercicio agregado'); return;
    }
    case 'quitar':
      rutinaDe(ui.alumnaId, ui.dia).splice(Number(b.dataset.valor), 1);
      guardar();
      break;
    case 'paso': {
      const ej = rutinaDe(ui.alumnaId, ui.dia)[Number(b.dataset.indice)];
      const campo = b.dataset.campo;
      ej[campo] = Math.max(MINIMOS[campo], ej[campo] + Number(b.dataset.delta) * PASOS[campo]);
      guardar();
      break;
    }
  }
  dibujar();
});

app.addEventListener('change', ev => {
  if (ev.target.dataset.cambio === 'ejercicio-grafico') { ui.ejercicioGrafico = ev.target.value; dibujar(); }
});

app.addEventListener('input', ev => {
  if (ev.target.name === 'comentario') ui.comentario = ev.target.value;
});

app.addEventListener('submit', ev => {
  ev.preventDefault();
  const f = ev.target;
  const campos = new FormData(f);

  if (f.dataset.form === 'registro') {
    const ej = rutinaDe(perfil.alumnaId, ui.dia)[Number(f.dataset.indice)];
    const hoy = fechaISO();
    const peso = Math.max(0, Number(campos.get('peso')) || 0);
    const reps = Math.max(0, Math.round(Number(campos.get('reps')) || 0));
    // Si ya había un registro de hoy para ese ejercicio, se reemplaza
    datos.registros = datos.registros.filter(r => !(r.alumnaId === perfil.alumnaId && r.nombre === ej.nombre && r.fecha === hoy));
    datos.registros.push({ alumnaId: perfil.alumnaId, nombre: ej.nombre, fecha: hoy, peso, reps });
    ui.registrando = null;
    guardar(); mostrarAviso('Registro guardado. Sumaste progreso');
  }

  if (f.dataset.form === 'encuesta') {
    if (!ui.estrellas) return;
    datos.encuestas.push({ area: f.dataset.area, autor: perfil.nombre, fecha: fechaISO(), puntaje: ui.estrellas, comentario: String(campos.get('comentario') || '').trim().slice(0, 300) });
    ui.estrellas = 0; ui.comentario = '';
    guardar(); mostrarAviso('Gracias. Tu respuesta ya llegó');
  }

  if (f.dataset.form === 'nueva-alumna') {
    const nombre = String(campos.get('nombre') || '').trim();
    if (!nombre) return;
    datos.alumnas.push({ id: 'a' + Date.now(), nombre, disciplina: campos.get('disciplina') });
    ui.nuevaAlumna = false;
    guardar(); mostrarAviso('Alumna agregada');
  }
});

// Si había una sesión abierta, entra directo a la primera pestaña
if (perfil) ui.pestana = PESTANAS[perfil.rol][0][0];
dibujar();
