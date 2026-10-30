/* =========================================================
   REKOVER — Listas fijas y datos de ejemplo
   Los datos de verdad se guardan en el servidor (ver servidor.js).
   Los ejemplos son INVENTADOS: sirven para probar la app.
   ========================================================= */

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

// Alumnas de ejemplo que el profesor puede cargar en el servidor para probar.
// Cada una se crea con su código de primer ingreso, como una alumna real.
function alumnasDeEjemplo() {
  const M = 'Musculación', F = 'Funcional';

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
      registros.push({ nombre, fecha: fechaISO(dia), series, reps, peso, pausa });
    });
  }

  return [
    {
      nombre: 'Sofía Gómez', dni: '30111222', disciplina: M, registros,
      rutinas: {
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
      notaProgreso: 'Muy buen avance: en 8 semanas subiste 12,5 kg en sentadilla sin perder técnica. Próximo objetivo: 50 kg con 8 repeticiones.',
      evaluacion: {
        fecha: registros[0].fecha, pesoCorporal: 62, altura: 165, objetivo: 'Fuerza', nivel: 'Principiante',
        antecedentes: 'Esguince de tobillo derecho hace 2 años, sin dolor actual.',
        observaciones: 'Buena movilidad de cadera. Trabajar técnica de sentadilla antes de subir cargas.',
        tests: [
          { nombre: 'Sentadilla: peso máximo (1RM estimado)', unidad: 'kg', resultado: 45, nota: 'Técnica correcta hasta 40 kg' },
          { nombre: 'Flexiones de brazos máximas', unidad: 'reps', resultado: 8, nota: 'Con rodillas apoyadas' },
          { nombre: 'Plancha (tiempo máximo)', unidad: 'seg', resultado: 50, nota: '' },
          { nombre: 'Salto vertical', unidad: 'cm', resultado: 28, nota: '' }
        ]
      }
    },
    {
      nombre: 'Valentina Ruiz', dni: '31222333', disciplina: F,
      rutinas: {
        1: [itemRutina(F, 'Sentadilla goblet', 4, 12, 12, 60), itemRutina(F, 'Burpees', 3, 10, 0, 45), itemRutina(F, 'Plancha lateral', 3, 30, 0, 30)],
        3: [itemRutina(F, 'Swing con kettlebell', 4, 15, 12, 60), itemRutina(F, 'Flexiones de brazos', 3, 10, 0, 45)],
        5: [itemRutina(F, 'Estocadas', 3, 12, 6, 60), itemRutina(F, 'Mountain climbers', 3, 30, 0, 30)]
      }
    },
    {
      nombre: 'Lucía Fernández', dni: '32444555', disciplina: M,
      rutinas: {
        1: [itemRutina(M, 'Prensa de piernas', 4, 12, 90, 90), itemRutina(M, 'Extensión de cuádriceps', 3, 12, 25, 60)],
        4: [itemRutina(M, 'Press de banca', 4, 10, 25, 90), itemRutina(M, 'Jalón al pecho', 4, 10, 30, 90)]
      }
    }
  ];
}
