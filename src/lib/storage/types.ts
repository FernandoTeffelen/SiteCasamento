/**
 * Contrato para armazenamento de imagens. A implementação futura pode usar
 * disco local no desenvolvimento, Cloudflare R2, S3 ou serviço equivalente.
 */
export interface ObjectStorage {
  put(input: UploadObjectInput): Promise<StoredObject>;
  /** Lê um objeto privado depois de a camada de domínio autorizar o acesso. */
  get(storageKey: string): Promise<StoredObjectContent>;
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

export interface StoredObjectContent {
  body: Uint8Array;
  contentType: string;
}
