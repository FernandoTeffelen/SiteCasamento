/**
 * Contrato para armazenamento de imagens. A implementação futura pode usar
 * disco local no desenvolvimento, Cloudflare R2, S3 ou serviço equivalente.
 */
export interface ObjectStorage {
  put(input: UploadObjectInput): Promise<StoredObject>;
  getPublicUrl(storageKey: string): string;
  delete(storageKey: string): Promise<void>;
}

export interface UploadObjectInput {
  storageKey: string;
  body: ReadableStream<Uint8Array> | Uint8Array;
  contentType: string;
}

export interface StoredObject {
  storageKey: string;
}

