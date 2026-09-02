import type { LocalUploadStatus, QueuePhotoInput, QueuedPhotoUpload } from "./types";

const DATABASE_NAME = "jogo-de-fotos-offline";
const DATABASE_VERSION = 2;
const PHOTO_STORE = "photo-uploads";

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Este navegador não oferece armazenamento local para fotos."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.objectStoreNames.contains(PHOTO_STORE)
        ? request.transaction!.objectStore(PHOTO_STORE)
        : database.createObjectStore(PHOTO_STORE, { keyPath: "id" });
      if (!store.indexNames.contains("by-event")) store.createIndex("by-event", "eventPublicId", { unique: false });
      if (!store.indexNames.contains("by-event-guest")) {
        store.createIndex("by-event-guest", ["eventPublicId", "guestToken"], { unique: false });
      }
      if (!store.indexNames.contains("by-created-at")) store.createIndex("by-created-at", "createdAt", { unique: false });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir o armazenamento local."));
  });
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PHOTO_STORE, mode);
    const request = operation(transaction.objectStore(PHOTO_STORE));
    let result: T;

    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error ?? new Error("Não foi possível salvar a foto localmente."));
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Não foi possível salvar a foto localmente."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("A gravação local da foto foi cancelada."));
    };
  });
}

function createQueueId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const values = crypto.getRandomValues(new Uint32Array(2));
  return `photo-${Date.now()}-${values[0].toString(36)}${values[1].toString(36)}`;
}

/** Guarda o arquivo original no navegador antes de qualquer tentativa de rede. */
export async function queuePhoto(input: QueuePhotoInput): Promise<QueuedPhotoUpload> {
  const photo: QueuedPhotoUpload = {
    ...input,
    id: createQueueId(),
    status: "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  await runTransaction("readwrite", (store) => store.add(photo));
  return photo;
}

export async function listQueuedPhotos(eventPublicId: string, guestToken?: string): Promise<QueuedPhotoUpload[]> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PHOTO_STORE, "readonly");
    const index = transaction.objectStore(PHOTO_STORE).index(guestToken ? "by-event-guest" : "by-event");
    const request = index.getAll(guestToken ? [eventPublicId, guestToken] : eventPublicId);

    request.onsuccess = () => {
      const photos = request.result.sort((first, second) => second.createdAt.localeCompare(first.createdAt));
      resolve(photos);
    };
    request.onerror = () => reject(request.error ?? new Error("Não foi possível ler as fotos locais."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
    transaction.onabort = () => database.close();
  });
}

export async function deleteQueuedPhoto(photoId: string): Promise<void> {
  await runTransaction("readwrite", (store) => store.delete(photoId));
}

export type QueuedPhotoUpdate = Partial<Pick<
  QueuedPhotoUpload,
  "status" | "attempts" | "remoteSubmissionId" | "lastError"
>>;

export async function updateQueuedPhoto(
  photoId: string,
  changes: QueuedPhotoUpdate,
): Promise<QueuedPhotoUpload> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PHOTO_STORE, "readwrite");
    const store = transaction.objectStore(PHOTO_STORE);
    const getRequest = store.get(photoId);
    let updatedPhoto: QueuedPhotoUpload | undefined;

    getRequest.onerror = () => reject(getRequest.error ?? new Error("Não foi possível localizar a foto."));
    getRequest.onsuccess = () => {
      const photo = getRequest.result as QueuedPhotoUpload | undefined;

      if (!photo) {
        transaction.abort();
        reject(new Error("Foto local não encontrada."));
        return;
      }

      updatedPhoto = { ...photo, ...changes };
      store.put(updatedPhoto);
    };

    transaction.oncomplete = () => {
      database.close();
      if (updatedPhoto) resolve(updatedPhoto);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Não foi possível atualizar a foto local."));
    };
    transaction.onabort = () => database.close();
  });
}

export async function updateQueuedPhotoStatus(
  photoId: string,
  status: LocalUploadStatus,
): Promise<void> {
  await updateQueuedPhoto(photoId, { status });
}
