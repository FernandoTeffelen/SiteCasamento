/**
 * Contrato para armazenamento de imagens. A implementação futura pode usar
 * disco local no desenvolvimento, Cloudflare R2, S3 ou serviço equivalente.
 */
export interface ObjectStorage {
  put(input: UploadObjectInput): Promise<StoredObject>;
  /**
   * Cria uma autorização curta e limitada a um único objeto para que o
   * navegador possa enviar arquivos sem atravessar a aplicação. Drivers que
   * não podem ser acessados pelo navegador (como o disco local) omitem este
   * recurso e usam o envio compatível pelo servidor.
   */
  createPresignedUpload?(input: PresignedUploadInput): Promise<PresignedUpload>;
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

export interface PresignedUploadInput {
  storageKey: string;
  contentType: string;
  expiresInSeconds: number;
}

export interface PresignedUpload {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
}

export interface StoredObject {
  storageKey: string;
}

export interface StoredObjectContent {
  body: Uint8Array;
  contentType: string;
}
