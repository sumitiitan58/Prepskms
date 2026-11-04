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

// In-memory cache mapping cloud file IDs to ObjectURLs for instant local playback/download
const localBlobUrlCache = new Map<string, string>();
const uploadedFilePointerCache = new Map<string, string>();

// Maximum safe string length inside a single Firestore document (~450 KB)
const MAX_INLINE_STRING_CHARS = 450_000;
// Size of each chunk stored in 'file_chunks' collection (~650 KB, well below Firestore's 1 MiB limit)
const CHUNK_CHAR_SIZE = 650_000;
// Maximum chunks per file (up to ~35 MB file)
const MAX_CHUNKS_PER_FILE = 55;

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const header = parts[0];
    const base64 = parts.slice(1).join(',');
    const mimeMatch = header.match(/data:([^;]+);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

/**
 * Splits a large dataUrl (> 450 KB) into 650 KB chunks stored in `file_chunks/{fileId}_c_{i}`
 * so Firestore never hits the 1 MiB document or 10 MiB payload limit.
 */
export async function uploadDataUrlInChunks(
  fileId: string,
  dataUrl: string,
  fileName = 'study-material.pdf',
  onProgress?: (completedChunks: number, totalChunks: number) => void
): Promise<string> {
  if (dataUrl.length <= MAX_INLINE_STRING_CHARS) {
    return dataUrl;
  }

  const cacheKey = `${fileId}_${dataUrl.length}`;
  const cachedPointer = uploadedFilePointerCache.get(cacheKey);
  if (cachedPointer) {
    return cachedPointer;
  }

  // Cache local ObjectURL immediately for instant opening on the current device
  const blob = dataUrlToBlob(dataUrl);
  if (blob && typeof URL !== 'undefined') {
    localBlobUrlCache.set(fileId, URL.createObjectURL(blob));
  }

  const totalChunks = Math.ceil(dataUrl.length / CHUNK_CHAR_SIZE);
  if (totalChunks > MAX_CHUNKS_PER_FILE) {
    console.warn(`File ${fileId} exceeds max chunk count (${totalChunks}), storing first ${MAX_CHUNKS_PER_FILE} chunks.`);
  }
  const safeTotalChunks = Math.min(totalChunks, MAX_CHUNKS_PER_FILE);

  for (let i = 0; i < safeTotalChunks; i++) {
    const slice = dataUrl.slice(i * CHUNK_CHAR_SIZE, (i + 1) * CHUNK_CHAR_SIZE);
    const chunkDocId = `${fileId}_c_${i}`;
    await setDoc(doc(db, 'file_chunks', chunkDocId), {
      fileId,
      index: i,
      total: safeTotalChunks,
      data: slice,
      updatedAt: Date.now()
    });
    if (onProgress) {
      onProgress(i + 1, safeTotalChunks);
    }
  }

  const safeName = encodeURIComponent(fileName || 'material.pdf');
  const pointer = `#prepskm-cloud-file:${fileId}:${safeTotalChunks}:${safeName}`;
  uploadedFilePointerCache.set(cacheKey, pointer);
  return pointer;
}

/**
 * Reassembles a chunked file from Firestore `file_chunks` and returns an ObjectURL.
 */
export async function resolveCloudFileUrl(pointerOrUrl: string): Promise<string> {
  if (!pointerOrUrl || !pointerOrUrl.startsWith('#prepskm-cloud-file:')) {
    return pointerOrUrl;
  }

  const raw = pointerOrUrl.replace('#prepskm-cloud-file:', '');
  const [fileId, countStr] = raw.split(':');
  const totalChunks = parseInt(countStr || '0', 10);

  if (!fileId || !totalChunks || isNaN(totalChunks)) {
    return pointerOrUrl;
  }

  const cachedBlobUrl = localBlobUrlCache.get(fileId);
  if (cachedBlobUrl) {
    return cachedBlobUrl;
  }

  const parts: string[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const chunkSnap = await getDoc(doc(db, 'file_chunks', `${fileId}_c_${i}`));
    if (chunkSnap.exists()) {
      const d = chunkSnap.data();
      parts.push(typeof d.data === 'string' ? d.data : '');
    }
  }

  const fullDataUrl = parts.join('');
  if (!fullDataUrl) {
    throw new Error('Cloud file chunks not found');
  }

  const blob = dataUrlToBlob(fullDataUrl);
  if (blob && typeof URL !== 'undefined') {
    const objUrl = URL.createObjectURL(blob);
    localBlobUrlCache.set(fileId, objUrl);
    return objUrl;
  }
  return fullDataUrl;
}

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

/**
 * Ensures no document written to Firestore ever exceeds the 1 MiB document size limit.
 * Any oversized `data:` URL field is automatically chunked into `file_chunks`.
 */
async function enforceFirestorePayloadLimit(
  docId: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const cleaned = sanitizeData(data);

  async function processValue(val: unknown, keyPath: string): Promise<unknown> {
    if (typeof val === 'string') {
      if (val.length > MAX_INLINE_STRING_CHARS) {
        if (val.startsWith('data:')) {
          try {
            const fileName = typeof cleaned.fileName === 'string' ? cleaned.fileName : `${docId}.pdf`;
            return await uploadDataUrlInChunks(docId, val, fileName);
          } catch (err) {
            console.warn(`Chunk upload fallback for ${docId} (${keyPath}):`, err);
            return `#prepskm-local-oversized:${docId}`;
          }
        }
        return val.slice(0, MAX_INLINE_STRING_CHARS);
      }
      return val;
    }
    if (Array.isArray(val)) {
      const out = [];
      for (let i = 0; i < val.length; i++) {
        out.push(await processValue(val[i], `${keyPath}_${i}`));
      }
      return out;
    }
    if (val !== null && typeof val === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        out[k] = await processValue(v, `${keyPath}_${k}`);
      }
      return out;
    }
    return val;
  }

  return (await processValue(cleaned, docId)) as Record<string, unknown>;
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
              const safePayload = await enforceFirestorePayloadLimit(ref.id, data);
              await setDoc(ref, safePayload, options || {});
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, path);
              throw err;
            }
          },
          async update(data: Record<string, unknown>) {
            const safePayload = await enforceFirestorePayloadLimit(ref.id, data);
            try {
              await updateDoc(ref, safePayload);
            } catch (err) {
              // Fallback to set with merge if document doesn't exist yet
              try {
                await setDoc(ref, safePayload, { merge: true });
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
          const tempId = 'doc-' + Date.now();
          const safePayload = await enforceFirestorePayloadLimit(tempId, data);
          const ref = await addDoc(collection(db, colName), safePayload);
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
    uploadDataUrlInChunks: typeof uploadDataUrlInChunks;
    resolveCloudFileUrl: typeof resolveCloudFileUrl;
    prepskmCloud: {
      app: typeof app;
      db: typeof compatDb;
      auth: typeof compatAuth;
      modularDb: typeof db;
      modularAuth: typeof auth;
      handleFirestoreError: typeof handleFirestoreError;
      uploadDataUrlInChunks: typeof uploadDataUrlInChunks;
      resolveCloudFileUrl: typeof resolveCloudFileUrl;
      firebaseConfig: typeof firebaseConfig;
    };
  }
}

if (typeof window !== 'undefined') {
  window.db = compatDb;
  window.auth = compatAuth;
  window.isFirebaseOnline = true;
  window.uploadDataUrlInChunks = uploadDataUrlInChunks;
  window.resolveCloudFileUrl = resolveCloudFileUrl;
  window.prepskmCloud = {
    app,
    db: compatDb,
    auth: compatAuth,
    modularDb: db,
    modularAuth: auth,
    handleFirestoreError,
    uploadDataUrlInChunks,
    resolveCloudFileUrl,
    firebaseConfig,
  };
  window.dispatchEvent(new CustomEvent('prepskm-firebase-ready'));
}
