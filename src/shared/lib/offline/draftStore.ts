'use client';

/**
 * Крошечный IndexedDB-стор для черновиков сессий психолога.
 * Офлайн-патч (UC-2): незавершённая запись не теряется при потере сети/перезагрузке.
 */
const DB = 'eSPSMS';
const STORE = 'session_drafts';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no indexedDB')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise<T | undefined>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

export type SessionDraft = { rawNote: string; dapData: string; dapAssessment: string; dapPlan: string; type: string };

export const saveDraft = (caseId: string, d: SessionDraft) => tx('readwrite', (s) => s.put(d, caseId));
export const loadDraft = (caseId: string) => tx<SessionDraft>('readonly', (s) => s.get(caseId));
export const clearDraft = (caseId: string) => tx('readwrite', (s) => s.delete(caseId));
