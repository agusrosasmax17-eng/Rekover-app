/* =========================================================
   REKOVER — Pantallas y acciones
   Cada pantalla es una función que devuelve HTML.
   Cuando algo cambia, se vuelve a dibujar todo con dibujar().
   ========================================================= */

let datos = cargarDatos();
let perfil = armarPerfil(cargarSesion());

// Estado de la pantalla (qué pestaña está abierta, qué alumna está elegida, etc.)
const ui = {
  pestana: null,
  errorIngreso: '',         // mensaje si el usuario o la contraseña no coinciden
  creandoClave: null,       // id de la alumna que está creando su contraseña (primer ingreso)
  seccionAlumna: 'rutina',  // en la ficha de la alumna: 'rutina' o 'evaluacion'
  agregandoTest: false,     // si está abierto el formulario para sumar un test
  testElegido: TESTS[0][0], // test elegido en ese formulario ('otro' = crear uno propio)
  filtro: 'Todas',          // filtro de disciplina en la lista de alumnas
  alumnaId: null,           // alumna elegida por el profesor
  dia: new Date().getDay(), // día de la rutina que se está viendo
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

// Arma los datos de la persona que ingresó a partir de su id
function armarPerfil(id) {
  if (!id) return null;
  const usuario = datos.usuarios.find(u => u.id === id);
  if (usuario) return { id, rol: usuario.rol, nombre: usuario.nombre };
  const alumna = datos.alumnas.find(a => a.id === id);
  if (alumna) return { id, rol: 'alumna', nombre: alumna.nombre, alumnaId: alumna.id };
  return null;
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

// Ejercicios de un músculo: los de la lista base más los que creó el profesor
function ejerciciosDe(disciplina, musculo) {
  const propios = datos.ejerciciosPropios[disciplina]?.[musculo] || [];
  return [...CATALOGO[disciplina][musculo], ...propios.map(([n, p]) => [n, p, true])];
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
  if (ui.creandoClave) return pantallaCrearClave();
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
      <p class="nota-chica">¿Es tu primera vez? Escribí tu DNI, dejá la contraseña vacía y tocá Ingresar.</p>
      ${ui.errorIngreso ? `<p class="error">${esc(ui.errorIngreso)}</p>` : ''}
      <button type="submit" class="boton ancho">Ingresar</button>
    </form>
    <button class="boton-texto reiniciar" data-accion="reiniciar">Volver a los datos de ejemplo</button>
  </section>`;
}

// Primer ingreso de una alumna: crea su propia contraseña
function pantallaCrearClave() {
  const alumna = alumnaPorId(ui.creandoClave);
  return `<section class="ingreso">
    ${logo(false)}
    <p class="ingreso-bajada">Sports Recovery</p>
    <h1>Hola, ${esc(alumna.nombre.split(' ')[0])}</h1>
    <p class="suave">Es tu primer ingreso. Creá tu contraseña: la vas a usar junto con tu DNI cada vez que entres.</p>
    <form class="form-ingreso" data-form="crear-clave">
      <label class="campo">Nueva contraseña
        <input name="clave" type="password" required minlength="6" autocomplete="new-password" placeholder="Mínimo 6 caracteres">
      </label>
      <label class="campo">Repetí la contraseña
        <input name="repetir" type="password" required minlength="6" autocomplete="new-password" placeholder="La misma de arriba">
      </label>
      ${ui.errorIngreso ? `<p class="error">${esc(ui.errorIngreso)}</p>` : ''}
      <button type="submit" class="boton ancho">Crear contraseña y entrar</button>
    </form>
    <button class="boton-texto" data-accion="cancelar-clave">‹ Volver</button>
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
    const base = hecho || ej; // si ya registró, se muestra lo que hizo
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
          <p class="registro-titulo">¿Qué hiciste hoy?</p>
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
          ${a.clave ? '' : '<em class="etiqueta-propio">Falta su primer ingreso</em>'}</span>
        <span class="flecha">›</span>
      </button>`;
    }).join('') || '<div class="tarjeta vacio">No hay alumnas en esta disciplina.</div>'}
    ${ui.nuevaAlumna ? `
      <form class="tarjeta" data-form="nueva-alumna">
        <h3>Nueva alumna</h3>
        <label class="campo">Nombre y apellido<input name="nombre" required maxlength="40" placeholder="Ej.: Ana Torres"></label>
        <label class="campo">DNI (sin puntos) — es su usuario para ingresar
          <input name="dni" required inputmode="numeric" pattern="[0-9]{7,8}" maxlength="8" placeholder="Ej.: 35123456"></label>
        <p class="nota-chica">La contraseña la crea ella la primera vez que entra con su DNI.</p>
        <label class="campo">Disciplina
          <select name="disciplina">${DISCIPLINAS.map(d => `<option>${d}</option>`).join('')}</select>
        </label>
        ${ui.errorAlumna ? `<p class="error">${esc(ui.errorAlumna)}</p>` : ''}
        <div class="fila-botones">
          <button type="button" class="boton secundario" data-accion="cerrar-nueva-alumna">Cancelar</button>
          <button type="submit" class="boton">Agregar</button>
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
    <div class="cuenta">
      ${alumna.clave
        ? `<span>Contraseña creada por ella</span><button class="boton-texto" data-accion="restablecer-clave">Restablecer</button>`
        : `<span>Todavía no entró: crea su contraseña en su primer ingreso con el DNI.</span>`}
    </div>
    <div class="pestanas-internas">${secciones.map(([id, texto]) =>
      `<button class="${ui.seccionAlumna === id ? 'activa' : ''}" data-accion="seccion-alumna" data-valor="${id}">${texto}</button>`).join('')}
    </div>
    ${ui.seccionAlumna === 'evaluacion' ? profesorEvaluacion(alumna) : profesorRutina(alumna)}`;
}

function profesorRutina(alumna) {
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

  return `<p class="suave">Elegí el día y armá la rutina.</p>
    ${selectorDias(alumna.id)}
    <h2>${DIAS[ui.dia]}</h2>
    ${items || '<div class="tarjeta vacio">Este día no tiene ejercicios todavía.</div>'}
    ${ui.agregando ? selectorEjercicios(alumna) : '<button class="boton ancho" data-accion="abrir-agregar">+ Agregar ejercicio</button>'}
    <h2>Mensaje de progreso</h2>
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
  const yaEstan = rutinaDe(alumna.id, ui.dia).map(e => e.nombre);
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

  switch (b.dataset.accion) {
    case 'salir':
      perfil = null; guardarSesion(null); ui.errorIngreso = ''; ui.creandoClave = null;
      break;
    case 'cancelar-clave': ui.creandoClave = null; ui.errorIngreso = ''; break;
    case 'reiniciar':
      if (!confirm('¿Borrar los cambios y volver a los datos de ejemplo?')) return;
      borrarDatos(); datos = cargarDatos();
      mostrarAviso('Datos de ejemplo restaurados'); return;
    case 'pestana':
      ui.pestana = v; ui.alumnaId = null; ui.agregando = false; ui.creando = false; ui.registrando = null;
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
    case 'filtro': ui.filtro = v; ui.nuevaAlumna = false; break;
    case 'elegir-alumna':
      ui.alumnaId = v; ui.agregando = false; ui.creando = false;
      ui.seccionAlumna = 'rutina'; ui.agregandoTest = false;
      ui.dia = new Date().getDay();
      break;
    case 'volver': ui.alumnaId = null; ui.agregando = false; ui.creando = false; break;
    case 'seccion-alumna': ui.seccionAlumna = v; ui.agregandoTest = false; break;
    case 'restablecer-clave': {
      const alumna = alumnaPorId(ui.alumnaId);
      if (!confirm(`¿Restablecer la contraseña de ${alumna.nombre}? La próxima vez que entre con su DNI va a crear una nueva.`)) return;
      alumna.clave = null;
      guardar(); mostrarAviso('Contraseña restablecida'); return;
    }
    case 'abrir-test': ui.agregandoTest = true; ui.testElegido = TESTS[0][0]; break;
    case 'cerrar-test': ui.agregandoTest = false; break;
    case 'quitar-test':
      datos.evaluaciones[ui.alumnaId].tests.splice(Number(v), 1);
      guardar();
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
      rutinaDe(alumna.id, ui.dia).push(itemRutina(alumna.disciplina, v, 3, 10, Number(b.dataset.peso), 60, ui.musculo));
      guardar(); mostrarAviso('Ejercicio agregado'); return;
    }
    case 'quitar':
      rutinaDe(ui.alumnaId, ui.dia).splice(Number(v), 1);
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
  const cambio = ev.target.dataset.cambio;
  if (cambio === 'ejercicio-grafico') { ui.ejercicioGrafico = ev.target.value; dibujar(); }
  if (cambio === 'tipo-test') { ui.testElegido = ev.target.value; dibujar(); }
  if (cambio === 'test-resultado') {
    const test = datos.evaluaciones[ui.alumnaId].tests[Number(ev.target.dataset.indice)];
    test.resultado = Math.max(0, Number(ev.target.value) || 0);
    guardar(); mostrarAviso('Resultado guardado');
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
    const resultado = buscarIngreso(datos, String(campos.get('usuario')), String(campos.get('clave')));
    ui.errorIngreso = '';
    if (!resultado) ui.errorIngreso = 'El usuario o la contraseña no coinciden. Revisalos e intentá de nuevo.';
    else if (resultado.crearClave) ui.creandoClave = resultado.crearClave;
    else entrar(resultado.id);
    dibujar();
  }

  if (f.dataset.form === 'crear-clave') {
    const clave = String(campos.get('clave'));
    if (clave.length < 6) ui.errorIngreso = 'La contraseña tiene que tener al menos 6 caracteres.';
    else if (clave !== campos.get('repetir')) ui.errorIngreso = 'Las dos contraseñas no son iguales. Escribilas de nuevo.';
    else {
      alumnaPorId(ui.creandoClave).clave = clave;
      guardar();
      entrar(ui.creandoClave);
      ui.creandoClave = null; ui.errorIngreso = '';
      mostrarAviso('Contraseña creada. ¡Bienvenida!'); return;
    }
    dibujar();
  }

  if (f.dataset.form === 'registro') {
    const ej = rutinaDe(perfil.alumnaId, ui.dia)[Number(f.dataset.indice)];
    const hoy = fechaISO();
    const registro = {
      alumnaId: perfil.alumnaId, nombre: ej.nombre, fecha: hoy,
      series: Math.round(num('series', 1)), reps: Math.round(num('reps', 0)),
      peso: num('peso', 0), pausa: Math.round(num('pausa', 0))
    };
    // Si ya había un registro de hoy para ese ejercicio, se reemplaza
    datos.registros = datos.registros.filter(r => !(r.alumnaId === perfil.alumnaId && r.nombre === ej.nombre && r.fecha === hoy));
    datos.registros.push(registro);
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
    const dni = String(campos.get('dni') || '').replace(/\D/g, '');
    if (!nombre || !dni) return;
    if (datos.alumnas.some(a => a.dni === dni) || datos.usuarios.some(u => u.usuario === dni)) {
      ui.errorAlumna = 'Ya hay una persona con ese DNI.'; dibujar(); return;
    }
    // Sin contraseña: la crea ella en su primer ingreso
    datos.alumnas.push({ id: 'a' + Date.now(), nombre, disciplina: campos.get('disciplina'), dni, clave: null });
    ui.nuevaAlumna = false; ui.errorAlumna = '';
    guardar(); mostrarAviso('Alumna creada. Ya puede entrar con su DNI');
  }

  if (f.dataset.form === 'crear-ejercicio') {
    const alumna = alumnaPorId(ui.alumnaId);
    const nombre = String(campos.get('nombre') || '').trim();
    if (!nombre) return;
    const peso = num('peso', 0);
    const porMusculo = datos.ejerciciosPropios[alumna.disciplina] || (datos.ejerciciosPropios[alumna.disciplina] = {});
    const lista = porMusculo[ui.musculo] || (porMusculo[ui.musculo] = []);
    // Queda guardado en la lista para usarlo con cualquier alumna
    if (!ejerciciosDe(alumna.disciplina, ui.musculo).some(e => e[0].toLowerCase() === nombre.toLowerCase())) lista.push([nombre, peso]);
    rutinaDe(alumna.id, ui.dia).push(itemRutina(alumna.disciplina, nombre, 3, 10, peso, 60, ui.musculo));
    ui.creando = false;
    guardar(); mostrarAviso('Ejercicio creado y agregado');
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
    guardar(); mostrarAviso('Evaluación guardada');
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
    guardar(); mostrarAviso('Test agregado');
  }

  if (f.dataset.form === 'nota') {
    const nota = String(campos.get('nota') || '').trim().slice(0, 400);
    if (nota) datos.notasProgreso[ui.alumnaId] = nota;
    else delete datos.notasProgreso[ui.alumnaId];
    guardar(); mostrarAviso('Mensaje guardado');
  }
});

// Abre la sesión de una persona y la lleva a su primera pestaña
function entrar(id) {
  perfil = armarPerfil(id);
  guardarSesion(id);
  ui.pestana = PESTANAS[perfil.rol][0][0];
  ui.alumnaId = null; ui.dia = new Date().getDay(); ui.estrellas = 0; ui.comentario = '';
}

// Si había una sesión abierta, entra directo a la primera pestaña
if (perfil) ui.pestana = PESTANAS[perfil.rol][0][0];
dibujar();
