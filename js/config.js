/* =========================================================
   REKOVER — Configuración del servidor (Firebase)
   Estos datos son públicos: Firebase los pensó para ir dentro de la app.
   La seguridad la dan las reglas de la base de datos (archivo firestore.rules).
   NUNCA poner acá una "clave privada" o "cuenta de servicio".
   ========================================================= */

export const firebaseConfig = {
  apiKey: 'AIzaSyBn7D4dZl-V0fv2qNVrxdkF8i9O8F6pYDE',
  authDomain: 'rekover-c2ae2.firebaseapp.com',
  projectId: 'rekover-c2ae2',
  storageBucket: 'rekover-c2ae2.firebasestorage.app',
  messagingSenderId: '550098884706',
  appId: '1:550098884706:web:5e0fb25a60db1fd720193b'
};

// Cuenta del profesor (se crea a mano en Firebase → Authentication → Users).
// En la app se ingresa escribiendo "profesor" como usuario.
// Si se cambia este correo, hay que cambiarlo también en firestore.rules.
export const PROFESOR_EMAIL = 'profesor@rekover.app';
export const NOMBRE_PROFESOR = 'Profesor';

// Las alumnas entran con su DNI. Por dentro, Firebase les asigna un correo
// inventado con este final (nunca se le manda nada a ese correo).
export const DOMINIO_ALUMNAS = 'alumnas.rekover.app';
