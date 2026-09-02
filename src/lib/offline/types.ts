/** Estados da fila local em IndexedDB; será implementada em uma etapa futura. */
export type LocalUploadStatus = "pending" | "uploading" | "uploaded" | "failed";

export interface QueuedPhotoUpload {
  id: string;
  eventPublicId: string;
  missionId: string;
  missionTitle: string;
  guestToken: string;
  file: Blob;
  contentType: string;
  status: LocalUploadStatus;
  attempts: number;
  /** Identificador do envio persistido no backend, quando confirmado. */
  remoteSubmissionId?: string;
  /** Último motivo conhecido; o arquivo nunca é descartado automaticamente. */
  lastError?: string;
  createdAt: string;
}

export type QueuePhotoInput = Omit<QueuedPhotoUpload, "id" | "status" | "attempts" | "createdAt">;
