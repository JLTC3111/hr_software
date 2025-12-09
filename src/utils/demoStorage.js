// Minimal IndexedDB helper for storing demo PDF files (blobs)

const DB_NAME = 'hr_demo_files_db';
const STORE_NAME = 'pdfs';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDemoPdf(employeeId, file) {
  const id = `demo_employee_pdf_${String(employeeId)}`;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record = { id, blob: file, name: file.name, createdAt: Date.now() };
    const req = store.put(record);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function getDemoPdf(employeeId) {
  const id = `demo_employee_pdf_${String(employeeId)}`;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      const result = req.result;
      if (result) resolve(result.blob);
      else resolve(null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDemoPdf(employeeId) {
  const id = `demo_employee_pdf_${String(employeeId)}`;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}
