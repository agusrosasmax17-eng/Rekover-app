/* =========================================================
   REKOVER — Datos de ejemplo y guardado en el navegador
   Todos los datos son INVENTADOS. Nada de datos reales.
   ========================================================= */

const CLAVE_DATOS = 'rekover_datos_v1';
const CLAVE_SESION = 'rekover_sesion_v1';

// Los tres perfiles de prueba de la pantalla de ingreso
const PERFILES = [
  { id: 'alumna',   rol: 'alumna',   nombre: 'Sofía Gómez',  detalle: 'Alumna de gimnasio',        alumnaId: 'a1' },
  { id: 'paciente', rol: 'paciente', nombre: 'Martín López', detalle: 'Paciente de kinesiología' },
  { id: 'profe',    rol: 'profesor', nombre: 'Lucas Pérez',  detalle: 'Profesor / Kinesiólogo' }
];

const DISCIPLINAS = ['Musculación', 'Funcional', 'Pilates'];

// Días de la semana (0 = domingo, como lo cuenta JavaScript)
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Lista de ejercicios agrupados por disciplina y por músculo.
// "peso" es el peso sugerido (en kg) al agregarlo; 0 = sin peso.
const CATALOGO = {
  'Musculación': {
    'Pecho':    [['Press de banca', 30], ['Press inclinado con mancuernas', 10], ['Aperturas con mancuernas', 6], ['Fondos en paralelas', 0]],
    'Espalda':  [['Jalón al pecho', 30], ['Remo con barra', 25], ['Remo con mancuerna', 12], ['Dominadas asistidas', 0]],
    'Piernas':  [['Sentadilla', 40], ['Prensa de piernas', 80], ['Extensión de cuádriceps', 25], ['Curl femoral', 20]],
    'Glúteos':  [['Hip thrust', 50], ['Patada de glúteo en polea', 10], ['Peso muerto rumano', 30], ['Abducción en máquina', 30]],
    'Hombros':  [['Press militar', 20], ['Elevaciones laterales', 5], ['Pájaros', 4], ['Face pull', 15]],
    'Bíceps':   [['Curl con barra', 15], ['Curl martillo', 8], ['Curl concentrado', 6]],
    'Tríceps':  [['Tríceps en polea', 15], ['Press francés', 10], ['Patada de tríceps', 5]],
    'Abdomen':  [['Plancha', 0], ['Crunch abdominal', 0], ['Elevación de piernas', 0]]
  },
  'Funcional': {
    'Tren superior': [['Flexiones de brazos', 0], ['Remo con banda', 0], ['Press con kettlebell', 8]],
    'Tren inferior': [['Sentadilla goblet', 12], ['Estocadas', 6], ['Peso muerto con kettlebell', 16], ['Saltos al cajón', 0]],
    'Core':          [['Plancha lateral', 0], ['Mountain climbers', 0], ['Rueda abdominal', 0]],
    'Cardio':        [['Burpees', 0], ['Soga', 0], ['Battle rope', 0], ['Swing con kettlebell', 12]]
  },
  'Pilates': {
    'Core':             [['The hundred', 0], ['Roll up', 0], ['Criss cross', 0]],
    'Piernas y glúteos': [['Puente de hombros', 0], ['Patadas laterales', 0], ['Footwork en reformer', 0]],
    'Espalda y postura': [['Swan', 0], ['Swimming', 0], ['Spine stretch', 0]],
    'Movilidad':        [['Círculos de pierna', 0], ['Gato-vaca', 0], ['Saw', 0]]
  }
};

// Busca a qué músculo pertenece un ejercicio
function musculoDe(disciplina, nombre) {
  const grupos = CATALOGO[disciplina] || {};
  for (const musculo in grupos) {
    if (grupos[musculo].some(e => e[0] === nombre)) return musculo;
  }
  return '';
}

// Fecha de hoy (u otro día) en formato AAAA-MM-DD, con la hora local
function fechaISO(fecha = new Date()) {
  const a = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

// Arma un ejercicio de rutina con valores iniciales
function itemRutina(disciplina, nombre, series, reps, peso, pausa) {
  return { nombre, musculo: musculoDe(disciplina, nombre), series, reps, peso, pausa };
}

// Crea todos los datos de ejemplo desde cero
function crearDatosDeEjemplo() {
  const M = 'Musculación', F = 'Funcional', P = 'Pilates';

  const alumnas = [
    { id: 'a1', nombre: 'Sofía Gómez',     disciplina: M },
    { id: 'a2', nombre: 'Valentina Ruiz',  disciplina: F },
    { id: 'a3', nombre: 'Camila Díaz',     disciplina: P },
    { id: 'a4', nombre: 'Lucía Fernández', disciplina: M },
    { id: 'a5', nombre: 'Martina Sosa',    disciplina: F }
  ];

  // Rutinas: para cada alumna, una lista de ejercicios por día de la semana
  const rutinas = {
    a1: {
      1: [itemRutina(M, 'Press de banca', 4, 10, 32.5, 90), itemRutina(M, 'Press inclinado con mancuernas', 3, 12, 10, 60),
          itemRutina(M, 'Tríceps en polea', 3, 12, 15, 60), itemRutina(M, 'Plancha', 3, 30, 0, 45)],
      2: [itemRutina(M, 'Sentadilla', 4, 10, 45, 120), itemRutina(M, 'Hip thrust', 4, 12, 60, 90),
          itemRutina(M, 'Curl femoral', 3, 12, 20, 60)],
      3: [itemRutina(M, 'Jalón al pecho', 4, 10, 32.5, 90), itemRutina(M, 'Remo con mancuerna', 3, 12, 12, 60),
          itemRutina(M, 'Curl con barra', 3, 10, 15, 60)],
      4: [itemRutina(M, 'Press militar', 4, 10, 20, 90), itemRutina(M, 'Elevaciones laterales', 3, 15, 5, 45),
          itemRutina(M, 'Crunch abdominal', 3, 20, 0, 45)],
      5: [itemRutina(M, 'Sentadilla', 4, 8, 47.5, 120), itemRutina(M, 'Press de banca', 3, 8, 35, 90),
          itemRutina(M, 'Hip thrust', 3, 10, 65, 90), itemRutina(M, 'Remo con barra', 3, 10, 25, 90)]
    },
    a2: {
      1: [itemRutina(F, 'Sentadilla goblet', 4, 12, 12, 60), itemRutina(F, 'Burpees', 3, 10, 0, 45), itemRutina(F, 'Plancha lateral', 3, 30, 0, 30)],
      3: [itemRutina(F, 'Swing con kettlebell', 4, 15, 12, 60), itemRutina(F, 'Flexiones de brazos', 3, 10, 0, 45)],
      5: [itemRutina(F, 'Estocadas', 3, 12, 6, 60), itemRutina(F, 'Mountain climbers', 3, 30, 0, 30)]
    },
    a3: {
      2: [itemRutina(P, 'The hundred', 1, 100, 0, 30), itemRutina(P, 'Roll up', 2, 8, 0, 30), itemRutina(P, 'Puente de hombros', 3, 10, 0, 30)],
      4: [itemRutina(P, 'Swan', 2, 8, 0, 30), itemRutina(P, 'Círculos de pierna', 2, 10, 0, 30)]
    },
    a4: {
      1: [itemRutina(M, 'Prensa de piernas', 4, 12, 90, 90), itemRutina(M, 'Extensión de cuádriceps', 3, 12, 25, 60)],
      4: [itemRutina(M, 'Press de banca', 4, 10, 25, 90), itemRutina(M, 'Jalón al pecho', 4, 10, 30, 90)]
    },
    a5: {}
  };

  // Historial inventado de Sofía: 8 semanas de registros para que los gráficos tengan datos
  const registros = [];
  const historial = [
    ['Press de banca', 25, 35, 8, 10],
    ['Sentadilla', 35, 47.5, 8, 10],
    ['Hip thrust', 45, 65, 10, 12],
    ['Jalón al pecho', 25, 32.5, 9, 11],
    ['Press militar', 15, 20, 8, 10]
  ];
  const hoy = new Date();
  for (let semana = 8; semana >= 1; semana--) {
    const dia = new Date(hoy);
    dia.setDate(hoy.getDate() - semana * 7);
    const avance = (8 - semana) / 7; // de 0 a 1
    historial.forEach(([nombre, pesoInicial, pesoFinal, repsMin, repsMax], i) => {
      const peso = Math.round((pesoInicial + (pesoFinal - pesoInicial) * avance) / 2.5) * 2.5;
      const reps = repsMin + ((semana + i) % (repsMax - repsMin + 1));
      registros.push({ alumnaId: 'a1', nombre, fecha: fechaISO(dia), peso, reps });
    });
  }

  const encuestas = [
    { area: 'gimnasio', autor: 'Valentina Ruiz', fecha: fechaISO(new Date(hoy.getTime() - 5 * 864e5)), puntaje: 5, comentario: 'Me encantan las clases de funcional.' },
    { area: 'gimnasio', autor: 'Camila Díaz',    fecha: fechaISO(new Date(hoy.getTime() - 3 * 864e5)), puntaje: 4, comentario: 'Muy buena atención, sumaría más horarios.' }
  ];

  return { alumnas, rutinas, registros, encuestas };
}

// Lee los datos del navegador; si no hay, crea los de ejemplo
function cargarDatos() {
  try {
    const guardado = localStorage.getItem(CLAVE_DATOS);
    if (guardado) return JSON.parse(guardado);
  } catch (e) { /* si falla, usamos los de ejemplo */ }
  const datos = crearDatosDeEjemplo();
  guardarDatos(datos);
  return datos;
}

function guardarDatos(datos) {
  try { localStorage.setItem(CLAVE_DATOS, JSON.stringify(datos)); } catch (e) { /* navegador sin espacio o privado */ }
}

function borrarDatos() {
  try { localStorage.removeItem(CLAVE_DATOS); } catch (e) { /* nada */ }
}

function cargarSesion() {
  try { return localStorage.getItem(CLAVE_SESION); } catch (e) { return null; }
}

function guardarSesion(perfilId) {
  try {
    if (perfilId) localStorage.setItem(CLAVE_SESION, perfilId);
    else localStorage.removeItem(CLAVE_SESION);
  } catch (e) { /* nada */ }
}
