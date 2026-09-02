import { listQueuedPhotos, updateQueuedPhoto } from "./photo-queue";
import type { QueuedPhotoUpload } from "./types";

type UploadResponse = {
  submission?: { id?: string };
  score?: number;
  awardedNow?: boolean;
  error?: { code?: string; message?: string };
};

export type UploadAttemptResult =
  | { ok: true; photo: QueuedPhotoUpload; score: number; awardedNow: boolean }
  | { ok: false; photo: QueuedPhotoUpload; retryWhenOnline: boolean; message: string };

function canUseNetwork() {
  return typeof navigator === "undefined" || navigator.onLine;
}

async function readPayload(response: Response): Promise<UploadResponse> {
  try {
    return await response.json() as UploadResponse;
  } catch {
    return {};
  }
}

/** Uma tentativa individual. O Blob só sai do IndexedDB após o servidor confirmar. */
export async function uploadQueuedPhoto(
  eventIdentifier: string,
  photo: QueuedPhotoUpload,
): Promise<UploadAttemptResult> {
  if (!canUseNetwork()) {
    const pendingPhoto = await updateQueuedPhoto(photo.id, {
      status: "pending",
      lastError: "Sem conexão. A foto será tentada novamente quando o site estiver aberto.",
    });
    return { ok: false, photo: pendingPhoto, retryWhenOnline: true, message: pendingPhoto.lastError ?? "Sem conexão." };
  }

  const uploadingPhoto = await updateQueuedPhoto(photo.id, {
    status: "uploading",
    attempts: photo.attempts + 1,
    lastError: undefined,
  });
  const formData = new FormData();
  formData.set("guestToken", uploadingPhoto.guestToken);
  formData.set("uploadId", uploadingPhoto.id);
  formData.set("photo", uploadingPhoto.file, "foto-original");

  try {
    const response = await fetch(
      `/api/events/${encodeURIComponent(eventIdentifier)}/missions/${encodeURIComponent(uploadingPhoto.missionId)}/submissions`,
      { method: "POST", body: formData },
    );
    const payload = await readPayload(response);

    if (!response.ok) {
      const message = payload.error?.message ?? "Não foi possível enviar a foto. Tente novamente.";
      const retryWhenOnline = payload.error?.code === "UPLOAD_IN_PROGRESS";
      const updatedPhoto = await updateQueuedPhoto(photo.id, {
        status: retryWhenOnline ? "pending" : "failed",
        lastError: message,
      });
      return { ok: false, photo: updatedPhoto, retryWhenOnline, message };
    }

    const uploadedPhoto = await updateQueuedPhoto(photo.id, {
      status: "uploaded",
      remoteSubmissionId: payload.submission?.id,
      lastError: undefined,
    });
    return { ok: true, photo: uploadedPhoto, score: payload.score ?? 0, awardedNow: payload.awardedNow ?? false };
  } catch {
    const pendingPhoto = await updateQueuedPhoto(photo.id, {
      status: "pending",
      lastError: "A conexão caiu antes da confirmação. Sua foto continua guardada neste aparelho.",
    });
    return { ok: false, photo: pendingPhoto, retryWhenOnline: true, message: pendingPhoto.lastError ?? "Conexão indisponível." };
  }
}

/** Reenvio quando a página está ativa. Safari não precisa de Background Sync. */
export async function uploadPendingPhotos(
  eventIdentifier: string,
  eventPublicId: string,
  guestToken?: string,
  onResult?: (result: UploadAttemptResult) => void,
) {
  const photos = await listQueuedPhotos(eventPublicId, guestToken);
  const recoveredPhotos = await Promise.all(photos.map(async (photo) => {
    if (photo.status !== "uploading") return photo;
    return updateQueuedPhoto(photo.id, {
      status: "pending",
      lastError: "O envio anterior foi interrompido. Tentando novamente.",
    });
  }));
  const pendingPhotos = recoveredPhotos.filter((photo) => photo.status === "pending");

  for (const photo of pendingPhotos) {
    const result = await uploadQueuedPhoto(eventIdentifier, photo);
    onResult?.(result);
    if (!result.ok && result.retryWhenOnline) break;
  }
}
