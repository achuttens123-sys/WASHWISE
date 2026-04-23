import { initializeApp, FirebaseError } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, browserPopupRedirectResolver } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

export { firebaseConfig };
const app = initializeApp(firebaseConfig);

// Use initializeAuth for more control and to help with iframe issues
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

// Initialize Firestore with settings to handle proxy/iframe connection issues
const firestoreSettings = {
  experimentalForceLongPolling: true,
  ignoreUndefinedProperties: true,
};

let dbInstance;
try {
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  dbInstance = initializeFirestore(app, firestoreSettings, dbId);
  console.log(`Firestore initialized with database ${dbId} and long polling settings`);
} catch (error) {
  console.error("Error initializing Firestore, falling back to default:", error);
  dbInstance = initializeFirestore(app, firestoreSettings);
}

export const db = dbInstance;
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

// Validate Connection to Firestore
import { getDocFromServer, doc } from 'firebase/firestore';
async function validateConnection() {
  try {
    await getDocFromServer(doc(db, 'system_test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
    // Other errors are handled by the app's error boundaries or specific calls
  }
}
validateConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  code?: string;
  userMessage: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  let errorCode = 'unknown';
  let userMessage = 'An unexpected database error occurred. Please try again.';

  if (error instanceof FirebaseError) {
    errorCode = error.code;
    switch (error.code) {
      case 'permission-denied':
        userMessage = 'You do not have permission to perform this action. Please check your account status.';
        break;
      case 'not-found':
        userMessage = 'The requested information could not be found.';
        break;
      case 'unavailable':
        userMessage = 'The database is temporarily unavailable. Please check your internet connection and try again.';
        break;
      case 'deadline-exceeded':
        userMessage = 'The request took too long to complete. Please try again.';
        break;
      case 'already-exists':
        userMessage = 'This record already exists in our system.';
        break;
      case 'resource-exhausted':
        userMessage = 'Our system is currently at capacity. Please try again in a few minutes.';
        break;
      case 'failed-precondition':
        userMessage = 'The operation could not be completed due to a system conflict.';
        break;
      case 'unauthenticated':
        userMessage = 'You must be signed in to perform this action.';
        break;
    }
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    code: errorCode,
    userMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
