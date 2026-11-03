/* =========================================================
   REKOVER — Conexión con el servidor (Firebase)
   Todo lo que se lee o se guarda en la base de datos pasa por acá.

   Quién es quién:
   - Administradora: la cuenta PROFESOR_EMAIL (usuario "profesor"). Ve todo y crea entrenadores.
   - Entrenador: tiene una ficha en entrenadores/{uid}. Ve y maneja solo sus alumnos.
   - Alumno: tiene una ficha en alumnas/{id}. Si lo creó un entrenador, la ficha guarda
     entrenadorUid (si está vacío, es alumno de la administradora).

   Cómo están guardados los datos:
   - accesos/{dni}              → qué cuenta usa cada alumno para ingresar con su DNI
   - accesosEntrenadores/{dni}  → qué cuenta usa cada entrenador para ingresar con su DNI
   - entrenadores/{uid}         → nombre, DNI y código de primer ingreso del entrenador
   - entrenadores/{uid}/avisos  → notificaciones para ese entrenador
   - alumnas/{id}               → datos del alumno, rutina semanal, cambios por fecha,
                                  evaluación y mensaje del profe
   - alumnas/{id}/registros     → lo que el alumno registró cada día, y además un documento
                                  "{fecha}_diario" por día con cómo se sintió (carita) y su comentario
   - alumnas/{id}/avisos        → notificaciones para el alumno
   - avisosProfe/{id}           → notificaciones para la administradora (de sus alumnos)
   - encuestas/{id}             → respuestas de la encuesta de satisfacción
   - config/ejercicios          → ejercicios propios de la administradora
   - config/ejercicios_{uid}    → ejercicios propios de cada entrenador

   Por dentro la colección se sigue llamando "alumnas" para no perder los datos
   ya cargados, pero en la app se muestra "alumnos".
   ========================================================= */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, initializeAuth, inMemoryPersistence, onAuthStateChanged,
  signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updatePassword
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  initializeFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc,
  query, where, limit, orderBy, onSnapshot, writeBatch, deleteField
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig, PROFESOR_EMAIL, NOMBRE_PROFESOR, DOMINIO_ALUMNAS, DOMINIO_ENTRENADORES } from './config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

// Segunda conexión, solo para crear cuentas nuevas sin cerrar la sesión de quien las crea
let authAltas = null;
function conexionAltas() {
  if (!authAltas) authAltas = initializeAuth(initializeApp(firebaseConfig, 'altas'), { persistence: inMemoryPersistence });
  return authAltas;
}

// Avisa cada vez que alguien entra o sale (también al abrir la app con la sesión ya abierta)
export function alCambiarSesion(funcion) { onAuthStateChanged(auth, funcion); }

// Convierte lo que escribió la persona (usuario, DNI o correo) en el correo de su cuenta.
// tipo: 'alumno' o 'entrenador' (lo que eligió en la pantalla de ingreso)
async function correoDeIngreso(usuario, tipo) {
  const limpio = usuario.trim().toLowerCase();
  if (limpio === 'profesor') return PROFESOR_EMAIL;
  if (limpio.includes('@')) return limpio;
  const dni = limpio.replace(/\D/g, '');
  if (!dni) return null;
  const acceso = await getDoc(doc(db, tipo === 'entrenador' ? 'accesosEntrenadores' : 'accesos', dni));
  return acceso.exists() ? acceso.data().email : null;
}

export async function ingresar(usuario, clave, tipo) {
  const correo = await correoDeIngreso(usuario, tipo);
  if (!correo) throw { code: 'rekover/no-existe' };
  await signInWithEmailAndPassword(auth, correo, clave);
}

export function salir() { return signOut(auth); }

function datosVacios() {
  return { alumnas: [], rutinas: {}, cambios: {}, registros: [], diario: {}, encuestas: [], notasProgreso: {}, ejerciciosPropios: {}, evaluaciones: {}, entrenadores: [] };
}

function sumarAlumna(datos, d) {
  const a = d.data();
  datos.alumnas.push({
    id: d.id, nombre: a.nombre, dni: a.dni, disciplina: a.disciplina,
    debeCambiarClave: !!a.debeCambiarClave, codigoInicial: a.codigoInicial || '',
    entrenadorUid: a.entrenadorUid || '', entrenadorNombre: a.entrenadorNombre || ''
  });
  datos.rutinas[d.id] = a.rutinas || {};
  datos.cambios[d.id] = a.cambios || {};
  if (a.notaProgreso) datos.notasProgreso[d.id] = a.notaProgreso;
  if (a.evaluacion) datos.evaluaciones[d.id] = a.evaluacion;
}

// Separa los registros de ejercicios del diario del día (carita + comentario)
function leerRegistros(alumnaId, docs) {
  const registros = [], diario = {};
  docs.forEach(d => {
    const r = d.data();
    if (r.tipo === 'diario') diario[r.fecha] = { sensacion: r.sensacion, comentario: r.comentario || '' };
    else registros.push({ alumnaId, ...r });
  });
  return { registros, diario };
}

// El entrenador (o la administradora) trae lo que registró un alumno, cuando abre su progreso
export async function cargarRegistrosDe(alumnaId) {
  return leerRegistros(alumnaId, (await getDocs(collection(db, 'alumnas', alumnaId, 'registros'))).docs);
}

const porNombre = (a, b) => a.nombre.localeCompare(b.nombre);
const porFecha = (a, b) => a.fecha.localeCompare(b.fecha);
const idEjercicios = entrenadorUid => entrenadorUid ? `ejercicios_${entrenadorUid}` : 'ejercicios';

// Trae del servidor lo que le corresponde ver a la persona que ingresó
export async function cargar(usuario) {
  const datos = datosVacios();

  // Administradora: ve todos los alumnos, todas las encuestas y la lista de entrenadores
  if (usuario.email === PROFESOR_EMAIL) {
    const [alumnas, encuestas, ejercicios, entrenadores] = await Promise.all([
      getDocs(collection(db, 'alumnas')),
      getDocs(collection(db, 'encuestas')),
      getDoc(doc(db, 'config', idEjercicios(''))),
      getDocs(collection(db, 'entrenadores'))
    ]);
    alumnas.forEach(d => sumarAlumna(datos, d));
    datos.alumnas.sort(porNombre);
    datos.encuestas = encuestas.docs.map(d => d.data()).sort(porFecha);
    if (ejercicios.exists()) datos.ejerciciosPropios = ejercicios.data().lista || {};
    datos.entrenadores = entrenadores.docs.map(d => ({ uid: d.id, ...d.data() })).sort(porNombre);
    return { perfil: { rol: 'profesor', esAdmin: true, nombre: NOMBRE_PROFESOR, uid: '' }, datos };
  }

  // Entrenador: solo sus alumnos y sus encuestas
  const entrenador = await getDoc(doc(db, 'entrenadores', usuario.uid));
  if (entrenador.exists()) {
    const e = entrenador.data();
    const [alumnas, encuestas, ejercicios] = await Promise.all([
      getDocs(query(collection(db, 'alumnas'), where('entrenadorUid', '==', usuario.uid))),
      getDocs(query(collection(db, 'encuestas'), where('entrenadorUid', '==', usuario.uid))),
      getDoc(doc(db, 'config', idEjercicios(usuario.uid)))
    ]);
    alumnas.forEach(d => sumarAlumna(datos, d));
    datos.alumnas.sort(porNombre);
    datos.encuestas = encuestas.docs.map(d => d.data()).sort(porFecha);
    if (ejercicios.exists()) datos.ejerciciosPropios = ejercicios.data().lista || {};
    return { perfil: { rol: 'profesor', esAdmin: false, nombre: e.nombre, uid: usuario.uid, debeCambiarClave: !!e.debeCambiarClave }, datos };
  }

  // Alumno: solo su propia ficha, sus registros y sus encuestas
  const propia = await getDocs(query(collection(db, 'alumnas'), where('uid', '==', usuario.uid), limit(1)));
  if (propia.empty) throw { code: 'rekover/sin-ficha' };
  const ficha = propia.docs[0];
  sumarAlumna(datos, ficha);
  const alumna = datos.alumnas[0];
  const [registros, encuestas, ejercicios] = await Promise.all([
    getDocs(collection(db, 'alumnas', ficha.id, 'registros')),
    getDocs(query(collection(db, 'encuestas'), where('uid', '==', usuario.uid))),
    getDoc(doc(db, 'config', idEjercicios(alumna.entrenadorUid)))
  ]);
  if (ejercicios.exists()) datos.ejerciciosPropios = ejercicios.data().lista || {};
  const leidos = leerRegistros(ficha.id, registros.docs);
  datos.registros = leidos.registros;
  datos.diario[ficha.id] = leidos.diario;
  datos.encuestas = encuestas.docs.map(d => d.data()).sort(porFecha);
  return {
    perfil: { rol: 'alumna', nombre: alumna.nombre, alumnaId: alumna.id, entrenadorUid: alumna.entrenadorUid, debeCambiarClave: alumna.debeCambiarClave },
    datos
  };
}

// Código de primer ingreso: 8 números al azar
function generarCodigo() {
  const numeros = crypto.getRandomValues(new Uint32Array(8));
  return Array.from(numeros, n => n % 10).join('');
}

// Crea una cuenta de ingreso con un código provisorio como contraseña
async function crearCuenta(dni, dominio) {
  const codigo = generarCodigo();
  const email = `${dni}.${Date.now().toString(36)}@${dominio}`;
  const conexion = conexionAltas();
  const credencial = await createUserWithEmailAndPassword(conexion, email, codigo);
  await signOut(conexion);
  return { uid: credencial.user.uid, email, codigo };
}

/* ---------- Alumnos ---------- */

// Un entrenador (o la administradora) da de alta a un alumno.
// entrenador: { uid, nombre } de quien lo crea (uid vacío = administradora).
// Devuelve el id del alumno y el código de primer ingreso.
export async function crearAlumna({ nombre, dni, disciplina }, entrenador, extra = {}) {
  if ((await getDoc(doc(db, 'accesos', dni))).exists()) throw { code: 'rekover/dni-repetido' };
  const cuenta = await crearCuenta(dni, DOMINIO_ALUMNAS);
  const ref = doc(collection(db, 'alumnas'));
  await setDoc(ref, {
    nombre, dni, disciplina, uid: cuenta.uid, debeCambiarClave: true, codigoInicial: cuenta.codigo,
    entrenadorUid: entrenador.uid, entrenadorNombre: entrenador.nombre,
    rutinas: {}, notaProgreso: '', creada: new Date().toISOString(), ...extra
  });
  await setDoc(doc(db, 'accesos', dni), { email: cuenta.email, entrenadorUid: entrenador.uid });
  return { id: ref.id, codigo: cuenta.codigo };
}

// Si el alumno se olvidó la contraseña: se le crea una cuenta nueva con otro código.
// La cuenta vieja deja de tener acceso a sus datos.
export async function restablecer(alumna) {
  const cuenta = await crearCuenta(alumna.dni, DOMINIO_ALUMNAS);
  await updateDoc(doc(db, 'alumnas', alumna.id), { uid: cuenta.uid, debeCambiarClave: true, codigoInicial: cuenta.codigo });
  await setDoc(doc(db, 'accesos', alumna.dni), { email: cuenta.email, entrenadorUid: alumna.entrenadorUid || '' });
  return cuenta.codigo;
}

/* ---------- Entrenadores (solo la administradora) ---------- */

export async function crearEntrenador({ nombre, dni }) {
  if ((await getDoc(doc(db, 'accesosEntrenadores', dni))).exists()) throw { code: 'rekover/dni-repetido-entrenador' };
  const cuenta = await crearCuenta(dni, DOMINIO_ENTRENADORES);
  const entrenador = { nombre, dni, debeCambiarClave: true, codigoInicial: cuenta.codigo, creado: new Date().toISOString() };
  await setDoc(doc(db, 'entrenadores', cuenta.uid), entrenador);
  await setDoc(doc(db, 'accesosEntrenadores', dni), { email: cuenta.email });
  return { uid: cuenta.uid, ...entrenador };
}

// Código nuevo para un entrenador: se le crea una cuenta nueva y sus alumnos,
// encuestas y ejercicios pasan a esa cuenta. La cuenta vieja deja de tener acceso.
export async function restablecerEntrenador(entrenador) {
  const cuenta = await crearCuenta(entrenador.dni, DOMINIO_ENTRENADORES);
  const viejo = entrenador.uid, nuevo = cuenta.uid;
  const { uid: _, ...datosEntrenador } = entrenador;
  await setDoc(doc(db, 'entrenadores', nuevo), { ...datosEntrenador, debeCambiarClave: true, codigoInicial: cuenta.codigo });

  const [alumnas, encuestas, ejercicios] = await Promise.all([
    getDocs(query(collection(db, 'alumnas'), where('entrenadorUid', '==', viejo))),
    getDocs(query(collection(db, 'encuestas'), where('entrenadorUid', '==', viejo))),
    getDoc(doc(db, 'config', idEjercicios(viejo)))
  ]);
  const lote = writeBatch(db);
  alumnas.forEach(d => {
    lote.update(d.ref, { entrenadorUid: nuevo });
    lote.set(doc(db, 'accesos', d.data().dni), { entrenadorUid: nuevo }, { merge: true });
  });
  encuestas.forEach(d => lote.update(d.ref, { entrenadorUid: nuevo }));
  if (ejercicios.exists()) lote.set(doc(db, 'config', idEjercicios(nuevo)), ejercicios.data());
  lote.set(doc(db, 'accesosEntrenadores', entrenador.dni), { email: cuenta.email });
  lote.delete(doc(db, 'entrenadores', viejo));
  await lote.commit();
  return { uid: nuevo, codigo: cuenta.codigo };
}

/* ---------- Contraseña propia (primer ingreso) ---------- */

// El alumno o el entrenador reemplaza el código por su propia contraseña
export async function cambiarClave(perfil, nueva) {
  await updatePassword(auth.currentUser, nueva);
  const ficha = perfil.rol === 'alumna' ? doc(db, 'alumnas', perfil.alumnaId) : doc(db, 'entrenadores', perfil.uid);
  await updateDoc(ficha, { debeCambiarClave: false, codigoInicial: deleteField() });
}

/* ---------- Rutinas, registros, encuestas ---------- */

export function guardarFicha(alumnaId, ficha) {
  return updateDoc(doc(db, 'alumnas', alumnaId), ficha);
}

// Un registro por ejercicio y por día: si lo cambia el mismo día, se reemplaza
export function guardarRegistro(alumnaId, registro) {
  const { alumnaId: _, ...resto } = registro;
  const id = `${registro.fecha}_${registro.nombre}`.replace(/\//g, '-');
  return setDoc(doc(db, 'alumnas', alumnaId, 'registros', id), resto);
}

// La encuesta queda a nombre del entrenador del alumno (vacío = administradora)
// Cómo se sintió el alumno ese día (carita) y su comentario. Uno por día: si lo cambia, se reemplaza.
export function guardarDiario(alumnaId, fecha, { sensacion, comentario }) {
  return setDoc(doc(db, 'alumnas', alumnaId, 'registros', `${fecha}_diario`), { tipo: 'diario', fecha, sensacion, comentario });
}

export function agregarEncuesta(encuesta) {
  return addDoc(collection(db, 'encuestas'), { ...encuesta, uid: auth.currentUser.uid });
}

export function guardarEjerciciosPropios(lista, entrenadorUid) {
  return setDoc(doc(db, 'config', idEjercicios(entrenadorUid)), { lista });
}

/* ---------- Notificaciones (la campanita) ---------- */

function carpetaDeAvisos(perfil) {
  if (perfil.rol === 'alumna') return collection(db, 'alumnas', perfil.alumnaId, 'avisos');
  return perfil.esAdmin ? collection(db, 'avisosProfe') : collection(db, 'entrenadores', perfil.uid, 'avisos');
}

// Escucha las notificaciones y avisa cada vez que llega una nueva (mientras la app está abierta).
// Devuelve una función para dejar de escuchar.
export function escucharAvisos(perfil, alCambiar) {
  return onSnapshot(query(carpetaDeAvisos(perfil), orderBy('fecha', 'desc'), limit(30)),
    foto => alCambiar(foto.docs.map(d => ({ id: d.id, ...d.data() }))),
    error => console.error(error));
}

// El alumno le avisa a su entrenador (o a la administradora si no tiene entrenador)
export function avisarAlProfe(alumnaId, texto, entrenadorUid) {
  const carpeta = entrenadorUid ? collection(db, 'entrenadores', entrenadorUid, 'avisos') : collection(db, 'avisosProfe');
  return addDoc(carpeta, { alumnaId, texto, fecha: new Date().toISOString(), leido: false });
}

export function avisarAlAlumno(alumnaId, texto) {
  return addDoc(collection(db, 'alumnas', alumnaId, 'avisos'), { texto, fecha: new Date().toISOString(), leido: false });
}

export function marcarLeidos(perfil, ids) {
  if (!ids.length) return Promise.resolve();
  const lote = writeBatch(db);
  const carpeta = carpetaDeAvisos(perfil);
  ids.forEach(id => lote.update(doc(carpeta, id), { leido: true }));
  return lote.commit();
}
