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
  createdAt: string;
}

export type QueuePhotoInput = Omit<QueuedPhotoUpload, "id" | "status" | "attempts" | "createdAt">;
