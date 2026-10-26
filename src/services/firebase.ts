import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  GET = 'get',
  LIST = 'list',
  UPDATE = 'update',
  DELETE = 'delete',
  WRITE = 'write'
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string): void {
  const err = error as { code?: string; message?: string };
  console.warn(`[Firestore ${operationType} on ${path}]`, err?.message || err);
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
