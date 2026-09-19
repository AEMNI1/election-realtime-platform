import { openDB } from 'idb';
import type { ResultValues } from './types';

export type PendingParticipation = {
  operationUuid: string;
  localBureauId: string;
  delta: number;
  deviceId: string;
  createdAt: string;
};

export type PendingResult = {
  operationUuid: string;
  localBureauId: string;
  results: ResultValues;
  createdAt: string;
};

let dbPromise: Promise<any> | null = null;

function getDb() {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB est disponible uniquement dans le navigateur.');
  }

  if (!dbPromise) {
    dbPromise = openDB('election-offline', 3, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains('participation')) {
          db.createObjectStore('participation', { keyPath: 'operationUuid' });
        }

        // V3 stockait une seule valeur de résultat. V4 stocke 7 catégories.
        if (oldVersion < 3 && db.objectStoreNames.contains('results')) {
          db.deleteObjectStore('results');
        }

        if (!db.objectStoreNames.contains('results')) {
          db.createObjectStore('results', { keyPath: 'operationUuid' });
        }
      }
    });
  }

  return dbPromise;
}

export async function enqueueParticipation(op: PendingParticipation) {
  return (await getDb()).put('participation', op);
}

export async function getPendingParticipation(): Promise<PendingParticipation[]> {
  return (await getDb()).getAll('participation');
}

export async function removePendingParticipation(id: string) {
  return (await getDb()).delete('participation', id);
}

export async function enqueueResult(op: PendingResult) {
  return (await getDb()).put('results', op);
}

export async function getPendingResults(): Promise<PendingResult[]> {
  return (await getDb()).getAll('results');
}

export async function removePendingResult(id: string) {
  return (await getDb()).delete('results', id);
}
