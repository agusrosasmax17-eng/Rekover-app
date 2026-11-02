/* =========================================================
   REKOVER — Leer rutinas desde una planilla de Excel
   Pensado para la planilla del profesor (MI_RUTINA_GYM.xlsx):
   - una hoja por semana ("Semana 1", "Semana 2"…)
   - bloques por día: una fila "DÍA 1 - PUSH" y debajo la fila de títulos
     (Ejercicio | Objetivo (series x reps) | Serie 1 Peso | Serie 1 Reps | … | Técnica / Notas)
   - una fila por ejercicio
   La herramienta para leer Excel (SheetJS) se descarga solo cuando hace falta.
   ========================================================= */

const LIBRERIA_EXCEL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';

function cargarLibreria() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((resolver, fallar) => {
    const script = document.createElement('script');
    script.src = LIBRERIA_EXCEL;
    script.onload = () => resolver(window.XLSX);
    script.onerror = () => fallar({ code: 'rekover/sin-libreria-excel' });
    document.head.appendChild(script);
  });
}

const texto = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const sinAcentos = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// "3x8-10" → 3 series de 8 a 10 · "4x12" → 4 series de 12 · "Al fallo x3" → 3 series al fallo
export function leerObjetivo(valor) {
  const t = sinAcentos(texto(valor));
  const fallo = t.match(/fallo\D*(\d+)/);
  if (fallo) return { series: Number(fallo[1]), reps: 10, repsTexto: 'Al fallo' };
  const partes = t.match(/(\d+)\s*[x×*]\s*(\d+)(?:\s*[-–a]\s*(\d+))?/);
  if (partes) {
    const series = Number(partes[1]), desde = Number(partes[2]), hasta = partes[3] ? Number(partes[3]) : null;
    return { series, reps: desde, repsTexto: hasta ? `${desde}-${hasta}` : null };
  }
  return { series: 3, reps: 10, repsTexto: null };
}

// Adivina el músculo por el nombre del ejercicio (y si no, por el nombre del día)
const PALABRAS_MUSCULO = [
  ['Glúteos', ['gluteo', 'hip thrust', 'bulgara', 'abduccion']],
  ['Piernas', ['sentadilla', 'prensa', 'cuadriceps', 'femoral', 'gemelo', 'estocada', 'pierna', 'peso muerto']],
  ['Tríceps', ['tricep', 'frances', 'fondos']],
  ['Bíceps', ['curl', 'bicep', 'predicador', 'martillo', 'arana', '21']],
  ['Espalda', ['jalon', 'remo', 'pull over', 'pullover', 'dominada', 'espalda']],
  ['Hombros', ['militar', 'vuelo', 'lateral', 'posterior', 'deltoide', 'face pull', 'pajaro', 'hombro']],
  ['Pecho', ['press banca', 'press de banca', 'inclinado', 'apertura', 'pecho', 'cruce', 'pec deck']],
  ['Abdomen', ['abdominal', 'plancha', 'crunch', 'abdomen']]
];
export function adivinarMusculo(nombre, tituloDia = '') {
  const n = sinAcentos(nombre);
  for (const [musculo, palabras] of PALABRAS_MUSCULO) if (palabras.some(p => n.includes(p))) return musculo;
  const d = sinAcentos(tituloDia);
  if (d.includes('push')) return 'Pecho';
  if (d.includes('pull')) return 'Espalda';
  if (d.includes('pierna') || d.includes('leg')) return 'Piernas';
  return 'Otro';
}

// Ubica cada columna según el título que tiene en la fila de "Ejercicio"
function columnasDe(fila) {
  const col = { ejercicio: 0, objetivo: -1, peso: -1, notas: -1, pausa: -1 };
  fila.forEach((valor, i) => {
    const t = sinAcentos(texto(valor));
    if (t.startsWith('ejercicio')) col.ejercicio = i;
    else if (t.includes('objetivo') || t.startsWith('series')) col.objetivo = i;
    else if (t.includes('peso') && col.peso < 0) col.peso = i; // la primera columna de peso (serie 1)
    else if (t.includes('nota') || t.includes('tecnica')) col.notas = i;
    else if (t.includes('pausa') || t.includes('descanso')) col.pausa = i;
  });
  return col;
}

function numeroDe(valor) {
  if (typeof valor === 'number') return valor;
  const m = texto(valor).replace(',', '.').match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

// Lee el archivo y devuelve { semanas: [{ nombre, dias: [{ titulo, ejercicios: [...] }] }] }
export async function leerPlanilla(archivo) {
  const XLSX = await cargarLibreria();
  const libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array' });
  const semanas = [];

  for (const nombreHoja of libro.SheetNames) {
    const filas = XLSX.utils.sheet_to_json(libro.Sheets[nombreHoja], { header: 1, raw: true, defval: '' });
    const dias = [];
    let dia = null, col = null;

    for (const fila of filas) {
      const primera = texto(fila[0]);
      if (!primera) continue;
      if (/^d[ií]a\s*\d+/i.test(primera)) { dia = { titulo: primera, ejercicios: [] }; dias.push(dia); col = null; continue; }
      if (sinAcentos(primera).startsWith('ejercicio')) { col = columnasDe(fila); continue; }
      if (!dia || !col) continue; // filas de título o instrucciones antes del primer día

      const nombre = texto(fila[col.ejercicio]);
      if (!nombre) continue;
      const objetivo = leerObjetivo(col.objetivo >= 0 ? fila[col.objetivo] : '');
      dia.ejercicios.push({
        nombre,
        musculo: adivinarMusculo(nombre, dia.titulo),
        series: objetivo.series,
        reps: objetivo.reps,
        ...(objetivo.repsTexto ? { repsTexto: objetivo.repsTexto } : {}),
        peso: col.peso >= 0 ? numeroDe(fila[col.peso]) : 0,
        pausa: col.pausa >= 0 && numeroDe(fila[col.pausa]) ? numeroDe(fila[col.pausa]) : 90,
        ...(col.notas >= 0 && texto(fila[col.notas]) ? { nota: texto(fila[col.notas]) } : {})
      });
    }
    if (dias.some(d => d.ejercicios.length)) semanas.push({ nombre: nombreHoja, dias });
  }
  if (!semanas.length) throw { code: 'rekover/planilla-vacia' };
  return { semanas };
}
