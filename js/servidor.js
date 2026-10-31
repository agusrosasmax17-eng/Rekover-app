/* =========================================================
   REKOVER — Conexión con el servidor (Firebase)
   Todo lo que se lee o se guarda en la base de datos pasa por acá.

   Cómo están guardados los datos:
   - accesos/{dni}            → qué cuenta usa cada DNI para ingresar
   - alumnas/{id}             → datos de la alumna, rutina semanal, cambios por fecha,
                                evaluación y mensaje del profe
   - alumnas/{id}/registros   → lo que la alumna registró cada día
   - encuestas/{id}           → respuestas de la encuesta de satisfacción
   - config/ejercicios        → ejercicios propios que creó el profesor
   ========================================================= */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, initializeAuth, inMemoryPersistence, onAuthStateChanged,
  signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updatePassword
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  initializeFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc,
  query, where, limit, deleteField
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig, PROFESOR_EMAIL, NOMBRE_PROFESOR, DOMINIO_ALUMNAS } from './config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

// Segunda conexión, solo para crear cuentas de alumnas sin cerrar la sesión del profesor
let authAltas = null;
function conexionAltas() {
  if (!authAltas) authAltas = initializeAuth(initializeApp(firebaseConfig, 'altas'), { persistence: inMemoryPersistence });
  return authAltas;
}

// Avisa cada vez que alguien entra o sale (también al abrir la app con la sesión ya abierta)
export function alCambiarSesion(funcion) { onAuthStateChanged(auth, funcion); }

// Convierte lo que escribió la persona (usuario, DNI o correo) en el correo de su cuenta
async function correoDeIngreso(usuario) {
  const limpio = usuario.trim().toLowerCase();
  if (limpio === 'profesor') return PROFESOR_EMAIL;
  if (limpio.includes('@')) return limpio;
  const dni = limpio.replace(/\D/g, '');
  if (!dni) return null;
  const acceso = await getDoc(doc(db, 'accesos', dni));
  return acceso.exists() ? acceso.data().email : null;
}

export async function ingresar(usuario, clave) {
  const correo = await correoDeIngreso(usuario);
  if (!correo) throw { code: 'rekover/no-existe' };
  await signInWithEmailAndPassword(auth, correo, clave);
}

export function salir() { return signOut(auth); }

// Trae del servidor lo que le corresponde ver a la persona que ingresó
export async function cargar(usuario) {
  const datos = { alumnas: [], rutinas: {}, cambios: {}, registros: [], encuestas: [], notasProgreso: {}, ejerciciosPropios: {}, evaluaciones: {} };
  const sumarAlumna = d => {
    const a = d.data();
    datos.alumnas.push({ id: d.id, nombre: a.nombre, dni: a.dni, disciplina: a.disciplina, debeCambiarClave: !!a.debeCambiarClave, codigoInicial: a.codigoInicial || '' });
    datos.rutinas[d.id] = a.rutinas || {};
    datos.cambios[d.id] = a.cambios || {};
    if (a.notaProgreso) datos.notasProgreso[d.id] = a.notaProgreso;
    if (a.evaluacion) datos.evaluaciones[d.id] = a.evaluacion;
  };

  if (usuario.email === PROFESOR_EMAIL) {
    const [alumnas, encuestas, ejercicios] = await Promise.all([
      getDocs(collection(db, 'alumnas')),
      getDocs(collection(db, 'encuestas')),
      getDoc(doc(db, 'config', 'ejercicios'))
    ]);
    alumnas.forEach(sumarAlumna);
    datos.alumnas.sort((a, b) => a.nombre.localeCompare(b.nombre));
    datos.encuestas = encuestas.docs.map(d => d.data()).sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (ejercicios.exists()) datos.ejerciciosPropios = ejercicios.data().lista || {};
    return { perfil: { rol: 'profesor', nombre: NOMBRE_PROFESOR }, datos };
  }

  // Alumna: solo su propia ficha, sus registros y sus encuestas
  const propia = await getDocs(query(collection(db, 'alumnas'), where('uid', '==', usuario.uid), limit(1)));
  if (propia.empty) throw { code: 'rekover/sin-ficha' };
  const ficha = propia.docs[0];
  sumarAlumna(ficha);
  const [registros, encuestas] = await Promise.all([
    getDocs(collection(db, 'alumnas', ficha.id, 'registros')),
    getDocs(query(collection(db, 'encuestas'), where('uid', '==', usuario.uid)))
  ]);
  datos.registros = registros.docs.map(d => ({ alumnaId: ficha.id, ...d.data() }));
  datos.encuestas = encuestas.docs.map(d => d.data()).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const alumna = datos.alumnas[0];
  return { perfil: { rol: 'alumna', nombre: alumna.nombre, alumnaId: alumna.id, debeCambiarClave: alumna.debeCambiarClave }, datos };
}

// Código de primer ingreso: 8 números al azar
function generarCodigo() {
  const numeros = crypto.getRandomValues(new Uint32Array(8));
  return Array.from(numeros, n => n % 10).join('');
}

// Crea la cuenta de ingreso de una alumna con un código provisorio como contraseña
async function crearCuenta(dni) {
  const codigo = generarCodigo();
  const email = `${dni}.${Date.now().toString(36)}@${DOMINIO_ALUMNAS}`;
  const conexion = conexionAltas();
  const credencial = await createUserWithEmailAndPassword(conexion, email, codigo);
  await signOut(conexion);
  return { uid: credencial.user.uid, email, codigo };
}

// El profesor da de alta a una alumna. Devuelve su id y el código de primer ingreso.
export async function crearAlumna({ nombre, dni, disciplina }, extra = {}) {
  if ((await getDoc(doc(db, 'accesos', dni))).exists()) throw { code: 'rekover/dni-repetido' };
  const cuenta = await crearCuenta(dni);
  const ref = doc(collection(db, 'alumnas'));
  await setDoc(ref, {
    nombre, dni, disciplina, uid: cuenta.uid, debeCambiarClave: true, codigoInicial: cuenta.codigo,
    rutinas: {}, notaProgreso: '', creada: new Date().toISOString(), ...extra
  });
  await setDoc(doc(db, 'accesos', dni), { email: cuenta.email });
  return { id: ref.id, codigo: cuenta.codigo };
}

// Si la alumna se olvidó la contraseña: se le crea una cuenta nueva con otro código.
// La cuenta vieja deja de tener acceso a sus datos.
export async function restablecer(alumna) {
  const cuenta = await crearCuenta(alumna.dni);
  await updateDoc(doc(db, 'alumnas', alumna.id), { uid: cuenta.uid, debeCambiarClave: true, codigoInicial: cuenta.codigo });
  await setDoc(doc(db, 'accesos', alumna.dni), { email: cuenta.email });
  return cuenta.codigo;
}

// La alumna reemplaza el código por su propia contraseña
export async function cambiarClave(alumnaId, nueva) {
  await updatePassword(auth.currentUser, nueva);
  await updateDoc(doc(db, 'alumnas', alumnaId), { debeCambiarClave: false, codigoInicial: deleteField() });
}

export function guardarFicha(alumnaId, ficha) {
  return updateDoc(doc(db, 'alumnas', alumnaId), ficha);
}

// Un registro por ejercicio y por día: si lo cambia el mismo día, se reemplaza
export function guardarRegistro(alumnaId, registro) {
  const { alumnaId: _, ...resto } = registro;
  const id = `${registro.fecha}_${registro.nombre}`.replace(/\//g, '-');
  return setDoc(doc(db, 'alumnas', alumnaId, 'registros', id), resto);
}

export function agregarEncuesta(encuesta) {
  return addDoc(collection(db, 'encuestas'), { ...encuesta, uid: auth.currentUser.uid });
}

export function guardarEjerciciosPropios(lista) {
  return setDoc(doc(db, 'config', 'ejercicios'), { lista });
}
