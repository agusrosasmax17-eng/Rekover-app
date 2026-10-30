/* =========================================================
   REKOVER — Datos de ejemplo y guardado en el navegador
   Todos los datos son INVENTADOS. Nada de datos reales.
   ========================================================= */

const CLAVE_DATOS = 'rekover_datos_v3';
const CLAVE_SESION = 'rekover_sesion_v3';

// Disciplinas activas. Pilates aparece como "Próximamente".
const DISCIPLINAS = ['Musculación', 'Funcional'];
const DISCIPLINAS_PROXIMAMENTE = ['Pilates'];

// Días de la semana (0 = domingo, como lo cuenta JavaScript)
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Lista base de ejercicios por disciplina y por músculo: [nombre, peso sugerido en kg].
// 0 = sin peso. El profesor puede sumar ejercicios propios desde la app.
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
  }
};

// Tests y ejercicios para la evaluación inicial: [nombre, unidad]
const TESTS = [
  ['Sentadilla: peso máximo (1RM estimado)', 'kg'],
  ['Press de banca: peso máximo (1RM estimado)', 'kg'],
  ['Peso muerto: peso máximo (1RM estimado)', 'kg'],
  ['Flexiones de brazos máximas', 'reps'],
  ['Sentadillas en 1 minuto', 'reps'],
  ['Abdominales en 1 minuto', 'reps'],
  ['Dominadas máximas', 'reps'],
  ['Plancha (tiempo máximo)', 'seg'],
  ['Sentarse y alcanzar (flexibilidad)', 'cm'],
  ['Salto vertical', 'cm'],
  ['Salto en largo sin carrera', 'cm'],
  ['Test de Cooper (12 minutos)', 'm'],
  ['Frecuencia cardíaca en reposo', 'ppm']
];
const UNIDADES = ['kg', 'reps', 'seg', 'cm', 'm', 'ppm', '%'];
const OBJETIVOS = ['Fuerza', 'Aumento de masa muscular', 'Bajar de peso', 'Rendimiento deportivo', 'Recuperación de lesión', 'Salud general'];
const NIVELES = ['Principiante', 'Intermedio', 'Avanzado'];

// Busca a qué músculo pertenece un ejercicio de la lista base
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
function itemRutina(disciplina, nombre, series, reps, peso, pausa, musculo) {
  return { nombre, musculo: musculo || musculoDe(disciplina, nombre), series, reps, peso, pausa };
}

// Crea todos los datos de ejemplo desde cero
function crearDatosDeEjemplo() {
  const M = 'Musculación', F = 'Funcional';

  // Profesor y paciente. Las alumnas entran con su DNI (más abajo).
  // El profesor crea a la alumna SIN contraseña: ella la crea en su primer ingreso (clave: null).
  // OJO: en este prototipo las contraseñas quedan guardadas en el navegador sin protección.
  // Sirven para probar, no son seguras para datos reales.
  const usuarios = [
    { id: 'profe',    rol: 'profesor', nombre: 'Lucas Pérez',  usuario: 'profesor', clave: 'rekover123' },
    { id: 'paciente', rol: 'paciente', nombre: 'Martín López', usuario: '28333444', clave: 'martin123' }
  ];

  const alumnas = [
    { id: 'a1', nombre: 'Sofía Gómez',     disciplina: M, dni: '30111222', clave: 'sofia123' },
    { id: 'a2', nombre: 'Valentina Ruiz',  disciplina: F, dni: '31222333', clave: 'vale123' },
    { id: 'a4', nombre: 'Lucía Fernández', disciplina: M, dni: '32444555', clave: 'lucia123' },
    { id: 'a5', nombre: 'Martina Sosa',    disciplina: F, dni: '33555666', clave: null } // todavía no entró
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
    a4: {
      1: [itemRutina(M, 'Prensa de piernas', 4, 12, 90, 90), itemRutina(M, 'Extensión de cuádriceps', 3, 12, 25, 60)],
      4: [itemRutina(M, 'Press de banca', 4, 10, 25, 90), itemRutina(M, 'Jalón al pecho', 4, 10, 30, 90)]
    },
    a5: {}
  };

  // Historial inventado de Sofía: 8 semanas de registros para que los gráficos tengan datos
  const registros = [];
  const historial = [
    // [ejercicio, peso inicial, peso final, reps mín, reps máx, series, pausa]
    ['Press de banca', 25, 35, 8, 10, 4, 90],
    ['Sentadilla', 35, 47.5, 8, 10, 4, 120],
    ['Hip thrust', 45, 65, 10, 12, 4, 90],
    ['Jalón al pecho', 25, 32.5, 9, 11, 4, 90],
    ['Press militar', 15, 20, 8, 10, 4, 90]
  ];
  const hoy = new Date();
  for (let semana = 8; semana >= 1; semana--) {
    const dia = new Date(hoy);
    dia.setDate(hoy.getDate() - semana * 7);
    const avance = (8 - semana) / 7; // de 0 a 1
    historial.forEach(([nombre, pesoInicial, pesoFinal, repsMin, repsMax, series, pausa], i) => {
      const peso = Math.round((pesoInicial + (pesoFinal - pesoInicial) * avance) / 2.5) * 2.5;
      const reps = repsMin + ((semana + i) % (repsMax - repsMin + 1));
      registros.push({ alumnaId: 'a1', nombre, fecha: fechaISO(dia), series, reps, peso, pausa });
    });
  }

  const encuestas = [
    { area: 'gimnasio', autor: 'Valentina Ruiz',  fecha: fechaISO(new Date(hoy.getTime() - 5 * 864e5)), puntaje: 5, comentario: 'Me encantan las clases de funcional.' },
    { area: 'gimnasio', autor: 'Lucía Fernández', fecha: fechaISO(new Date(hoy.getTime() - 3 * 864e5)), puntaje: 4, comentario: 'Muy buena atención, sumaría más horarios.' }
  ];

  // Mensaje del profesor sobre el progreso de cada alumna
  const notasProgreso = {
    a1: 'Muy buen avance: en 8 semanas subiste 12,5 kg en sentadilla sin perder técnica. Próximo objetivo: 50 kg con 8 repeticiones.'
  };

  // Ejercicios que crea el profesor: { disciplina: { músculo: [[nombre, peso]] } }
  const ejerciciosPropios = {};

  // Evaluación inicial que carga el profesor para cada alumna
  const evaluaciones = {
    a1: {
      fecha: registros[0].fecha, pesoCorporal: 62, altura: 165,
      objetivo: 'Fuerza', nivel: 'Principiante',
      antecedentes: 'Esguince de tobillo derecho hace 2 años, sin dolor actual.',
      observaciones: 'Buena movilidad de cadera. Trabajar técnica de sentadilla antes de subir cargas.',
      tests: [
        { nombre: 'Sentadilla: peso máximo (1RM estimado)', unidad: 'kg', resultado: 45, nota: 'Técnica correcta hasta 40 kg' },
        { nombre: 'Flexiones de brazos máximas', unidad: 'reps', resultado: 8, nota: 'Con rodillas apoyadas' },
        { nombre: 'Plancha (tiempo máximo)', unidad: 'seg', resultado: 50, nota: '' },
        { nombre: 'Salto vertical', unidad: 'cm', resultado: 28, nota: '' }
      ]
    }
  };

  return { usuarios, alumnas, rutinas, registros, encuestas, notasProgreso, ejerciciosPropios, evaluaciones };
}

// Busca a la persona que quiere ingresar.
// Profesor y paciente entran con su usuario; las alumnas, con su DNI.
// Devuelve { id } si todo coincide, { crearClave: id } si es una alumna
// que todavía no creó su contraseña, o null si no coincide.
function buscarIngreso(datos, usuario, clave) {
  const u = usuario.trim().toLowerCase().replace(/\./g, '');
  const encontrado = datos.usuarios.find(x => x.usuario.toLowerCase() === u)
    || datos.alumnas.find(x => x.dni === u);
  if (!encontrado) return null;
  if (!encontrado.clave) return { crearClave: encontrado.id };
  return encontrado.clave === clave ? { id: encontrado.id } : null;
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

function guardarSesion(id) {
  try {
    if (id) localStorage.setItem(CLAVE_SESION, id);
    else localStorage.removeItem(CLAVE_SESION);
  } catch (e) { /* nada */ }
}
