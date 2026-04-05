import { initializeApp, FirebaseError } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, browserPopupRedirectResolver } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export { firebaseConfig };
const app = initializeApp(firebaseConfig);

// Use initializeAuth for more control and to help with iframe issues
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

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
