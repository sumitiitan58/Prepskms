import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  User
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy as fbOrderBy,
  limit as fbLimit,
  where as fbWhere,
  QueryConstraint,
  DocumentData
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

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
  };
}

// Initialize Firebase App with named Firestore database from firebase-applet-config.json
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Clean undefined values recursively so Firestore setDoc/addDoc never rejects undefined fields
function sanitizeData<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeData(item)) as unknown as T;
  }
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v !== undefined) {
      cleaned[k] = sanitizeData(v);
    }
  }
  return cleaned as T;
}

function wrapDocSnapshot(snap: { id: string; exists: () => boolean; data: () => DocumentData | undefined }) {
  return {
    id: snap.id,
    exists: snap.exists(),
    data: () => snap.data(),
  };
}

function wrapQuerySnapshot(snap: { empty: boolean; size: number; docs: Array<{ id: string; data: () => DocumentData }> }) {
  const wrappedDocs = snap.docs.map((d) => ({
    id: d.id,
    exists: true,
    data: () => d.data(),
  }));
  return {
    empty: snap.empty,
    size: snap.size,
    docs: wrappedDocs,
    forEach: (cb: (docSnap: { id: string; exists: boolean; data: () => DocumentData }) => void) => {
      wrappedDocs.forEach(cb);
    },
  };
}

function createQueryWrapper(colName: string, constraints: QueryConstraint[] = []) {
  const colRef = collection(db, colName);
  return {
    orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
      return createQueryWrapper(colName, [...constraints, fbOrderBy(field, direction)]);
    },
    limit(n: number) {
      return createQueryWrapper(colName, [...constraints, fbLimit(n)]);
    },
    where(field: string, op: any, value: unknown) {
      return createQueryWrapper(colName, [...constraints, fbWhere(field, op, value)]);
    },
    async get() {
      try {
        const q = constraints.length > 0 ? query(colRef, ...constraints) : colRef;
        const snap = await getDocs(q);
        return wrapQuerySnapshot(snap);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, colName);
        throw err;
      }
    },
    onSnapshot(
      onNext: (snap: ReturnType<typeof wrapQuerySnapshot>) => void,
      onError?: (err: unknown) => void
    ) {
      const q = constraints.length > 0 ? query(colRef, ...constraints) : colRef;
      return onSnapshot(
        q,
        (snap) => {
          onNext(wrapQuerySnapshot(snap));
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, colName);
          if (onError) onError(err);
        }
      );
    },
  };
}

export const compatDb = {
  collection(colName: string) {
    const baseQuery = createQueryWrapper(colName, []);
    return {
      ...baseQuery,
      doc(docId?: string) {
        const ref = docId ? doc(db, colName, String(docId)) : doc(collection(db, colName));
        const path = `${colName}/${ref.id}`;
        return {
          id: ref.id,
          async get() {
            try {
              const snap = await getDoc(ref);
              return wrapDocSnapshot(snap);
            } catch (err) {
              handleFirestoreError(err, OperationType.GET, path);
              throw err;
            }
          },
          async set(data: Record<string, unknown>, options?: { merge?: boolean }) {
            try {
              await setDoc(ref, sanitizeData(data), options || {});
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, path);
              throw err;
            }
          },
          async update(data: Record<string, unknown>) {
            try {
              await updateDoc(ref, sanitizeData(data));
            } catch (err) {
              // Fallback to set with merge if document doesn't exist yet
              try {
                await setDoc(ref, sanitizeData(data), { merge: true });
              } catch (innerErr) {
                handleFirestoreError(innerErr, OperationType.UPDATE, path);
                throw innerErr;
              }
            }
          },
          async delete() {
            try {
              await deleteDoc(ref);
            } catch (err) {
              handleFirestoreError(err, OperationType.DELETE, path);
              throw err;
            }
          },
          onSnapshot(
            onNext: (snap: ReturnType<typeof wrapDocSnapshot>) => void,
            onError?: (err: unknown) => void
          ) {
            return onSnapshot(
              ref,
              (snap) => {
                onNext(wrapDocSnapshot(snap));
              },
              (err) => {
                handleFirestoreError(err, OperationType.GET, path);
                if (onError) onError(err);
              }
            );
          },
        };
      },
      async add(data: Record<string, unknown>) {
        try {
          const ref = await addDoc(collection(db, colName), sanitizeData(data));
          return { id: ref.id };
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, colName);
          throw err;
        }
      },
    };
  },
};

export const compatAuth = {
  get currentUser(): User | null {
    return auth.currentUser;
  },
  onAuthStateChanged(cb: (user: User | null) => void) {
    return fbOnAuthStateChanged(auth, cb);
  },
  async signInWithPopup(_provider?: unknown) {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  },
  async signOut() {
    return fbSignOut(auth);
  },
};

declare global {
  interface Window {
    db: typeof compatDb;
    auth: typeof compatAuth;
    isFirebaseOnline: boolean;
    prepskmCloud: {
      app: typeof app;
      db: typeof compatDb;
      auth: typeof compatAuth;
      modularDb: typeof db;
      modularAuth: typeof auth;
      handleFirestoreError: typeof handleFirestoreError;
      firebaseConfig: typeof firebaseConfig;
    };
  }
}

if (typeof window !== 'undefined') {
  window.db = compatDb;
  window.auth = compatAuth;
  window.isFirebaseOnline = true;
  window.prepskmCloud = {
    app,
    db: compatDb,
    auth: compatAuth,
    modularDb: db,
    modularAuth: auth,
    handleFirestoreError,
    firebaseConfig,
  };
  window.dispatchEvent(new CustomEvent('prepskm-firebase-ready'));
}
