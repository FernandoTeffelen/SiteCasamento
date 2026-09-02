/**
 * Contrato para armazenamento de imagens. A implementação futura pode usar
 * disco local no desenvolvimento, Cloudflare R2, S3 ou serviço equivalente.
 */
export interface ObjectStorage {
  put(input: UploadObjectInput): Promise<StoredObject>;
  /** Não deve ser usado para expor fotos privadas sem autorização. */
  getPublicUrl(storageKey: string): string;
  delete(storageKey: string): Promise<void>;
}

export interface UploadObjectInput {
  storageKey: string;
  body: Uint8Array;
  contentType: string;
}

export interface StoredObject {
  storageKey: string;
}
