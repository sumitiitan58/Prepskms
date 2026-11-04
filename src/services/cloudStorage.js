import {
  db,
  uploadDataUrlInChunks,
  resolveCloudFileUrl,
} from '../firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';

/**
 * Cloud Storage & Study Material Synchronization Service
 * Handles multi-megabyte PDF uploads safely via chunked Firestore storage (650 KB chunks)
 * so uploads never hit the 1 MiB / 10 MiB Firestore payload limit, and syncs metadata
 * in `study_materials` and `materials` collections across all student devices in real time.
 */

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a PDF File or DataURL to Cloud Storage chunks and saves metadata in Firestore
 * (`study_materials` and `materials` collections).
 */
export async function uploadStudyMaterialPdf(fileOrDataUrl, metadata = {}, onProgress) {
  const materialId = metadata.id || `pdf-${Date.now()}`;
  const fileName =
    metadata.fileName ||
    (fileOrDataUrl && typeof fileOrDataUrl === 'object' && fileOrDataUrl.name) ||
    `${(metadata.title || 'study-material').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

  let pdfPointerOrUrl = '';

  if (typeof fileOrDataUrl === 'string') {
    if (fileOrDataUrl.startsWith('data:')) {
      pdfPointerOrUrl = await uploadDataUrlInChunks(
        materialId,
        fileOrDataUrl,
        fileName,
        onProgress
      );
    } else {
      pdfPointerOrUrl = fileOrDataUrl.trim();
    }
  } else if (fileOrDataUrl && typeof fileOrDataUrl === 'object') {
    const dataUrl = await readFileAsDataUrl(fileOrDataUrl);
    pdfPointerOrUrl = await uploadDataUrlInChunks(
      materialId,
      dataUrl,
      fileName,
      onProgress
    );
  }

  const safeUrlString = typeof pdfPointerOrUrl === 'string' ? pdfPointerOrUrl : String(pdfPointerOrUrl || '');

  const nowIso = new Date().toISOString();
  const record = {
    id: materialId,
    title: metadata.title || 'Study Material PDF',
    sectionId: metadata.sectionId || 'sec-notes',
    sectionName: metadata.sectionName || 'Revision Notes',
    exam: metadata.exam || 'JEE',
    subject: metadata.subject || 'Physics',
    chapter: metadata.chapter || 'General',
    category: (metadata.subject || 'physics').toLowerCase(),
    type: metadata.type || 'PDF',
    pages: Number(metadata.pages) || 12,
    size: metadata.size || '1.4 MB',
    author: metadata.author || 'Sumit (@unfiltereddsumit)',
    dateAdded: metadata.dateAdded || nowIso.slice(0, 10),
    created_at: metadata.created_at || nowIso,
    createdAt: metadata.createdAt || nowIso,
    updatedAt: nowIso,
    fileName,
    pdf_url: safeUrlString,
    downloadUrl: safeUrlString,
    isFileUpload: true,
    content:
      metadata.content ||
      `<h3>${metadata.title || 'Study Material'} (${metadata.subject || 'Physics'} • ${metadata.chapter || 'General'})</h3><p>Curated by Mentor Sumit (@unfiltereddsumit). Click Download PDF to view or save the full document.</p>`,
  };

  await setDoc(doc(db, 'study_materials', materialId), record, { merge: true });
  await setDoc(doc(db, 'materials', materialId), record, { merge: true });

  return record;
}

/**
 * Resolves a `#prepskm-cloud-file:...` pointer back into a downloadable Data URL / Blob URL,
 * or returns standard https:// links directly.
 */
export async function resolveStudyMaterialUrl(pointerOrUrl) {
  return resolveCloudFileUrl(pointerOrUrl);
}

/**
 * Subscribes to real-time updates from `study_materials` in Firestore.
 */
export function subscribeToStudyMaterials(callback) {
  const colRef = collection(db, 'study_materials');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      items.sort((a, b) =>
        String(b.created_at || b.dateAdded || '').localeCompare(
          String(a.created_at || a.dateAdded || '')
        )
      );
      callback(items);
    },
    (err) => {
      console.warn('study_materials listener error:', err);
    }
  );
}

/**
 * Deletes a study material document from both `study_materials` and `materials`.
 */
export async function deleteStudyMaterial(materialId) {
  if (!materialId) return;
  await deleteDoc(doc(db, 'study_materials', String(materialId)));
  await deleteDoc(doc(db, 'materials', String(materialId)));
}

if (typeof window !== 'undefined') {
  window.prepskmStorageService = {
    uploadStudyMaterialPdf,
    resolveStudyMaterialUrl,
    subscribeToStudyMaterials,
    deleteStudyMaterial,
  };
}
