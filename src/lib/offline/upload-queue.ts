import { listQueuedPhotos, updateQueuedPhoto } from "./photo-queue";
import type { QueuedPhotoUpload } from "./types";

type UploadResponse = {
  mode?: "direct" | "completed" | "server";
  submission?: { id?: string };
  score?: number;
  awardedNow?: boolean;
  upload?: { url?: string; method?: "PUT"; headers?: Record<string, string> };
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

function shouldRetry(errorCode: string | undefined) {
  return errorCode === "UPLOAD_IN_PROGRESS"
    || errorCode === "UPLOAD_STORAGE_FAILED"
    || errorCode === "UPLOAD_SIGNING_FAILED"
    || errorCode === "RATE_LIMITED";
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
  if (!uploadingPhoto.legalAcceptance) {
    const failedPhoto = await updateQueuedPhoto(photo.id, {
      status: "failed",
      lastError: "Confirme os Termos de Uso e a Política de Privacidade antes de reenviar esta foto.",
    });
    return { ok: false, photo: failedPhoto, retryWhenOnline: false, message: failedPhoto.lastError ?? "Aceite necessário." };
  }

  const endpoint = `/api/events/${encodeURIComponent(eventIdentifier)}/missions/${encodeURIComponent(uploadingPhoto.missionId)}/submissions`;
  const complete = async (payload: UploadResponse): Promise<UploadAttemptResult> => {
    const uploadedPhoto = await updateQueuedPhoto(photo.id, {
      status: "uploaded",
      remoteSubmissionId: payload.submission?.id,
      lastError: undefined,
    });
    return { ok: true, photo: uploadedPhoto, score: payload.score ?? 0, awardedNow: payload.awardedNow ?? false };
  };
  const failFromPayload = async (payload: UploadResponse): Promise<UploadAttemptResult> => {
    const message = payload.error?.message ?? "Não foi possível enviar a foto. Tente novamente.";
    const retryWhenOnline = shouldRetry(payload.error?.code);
    const updatedPhoto = await updateQueuedPhoto(photo.id, {
      status: retryWhenOnline ? "pending" : "failed",
      lastError: message,
    });
    return { ok: false, photo: updatedPhoto, retryWhenOnline, message };
  };
  const uploadThroughApplication = async (): Promise<UploadAttemptResult> => {
    const formData = new FormData();
    formData.set("guestToken", uploadingPhoto.guestToken);
    formData.set("uploadId", uploadingPhoto.id);
    formData.set("photo", uploadingPhoto.file, "foto-original");
    formData.set("acceptedLegalDocuments", "true");
    formData.set("termsVersion", uploadingPhoto.legalAcceptance!.termsVersion);
    formData.set("privacyVersion", uploadingPhoto.legalAcceptance!.privacyVersion);
    formData.set("legalAcceptedAt", uploadingPhoto.legalAcceptance!.acceptedAt);

    const response = await fetch(endpoint, { method: "POST", body: formData });
    const payload = await readPayload(response);
    return response.ok ? complete(payload) : failFromPayload(payload);
  };

  try {
    const intentResponse = await fetch(`${endpoint}/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestToken: uploadingPhoto.guestToken,
        uploadId: uploadingPhoto.id,
        file: {
          size: uploadingPhoto.file.size,
          type: uploadingPhoto.file.type,
          name: "foto-original",
        },
        acceptedLegalDocuments: true,
        termsVersion: uploadingPhoto.legalAcceptance.termsVersion,
        privacyVersion: uploadingPhoto.legalAcceptance.privacyVersion,
        legalAcceptedAt: uploadingPhoto.legalAcceptance.acceptedAt,
      }),
    });
    const intent = await readPayload(intentResponse);
    if (!intentResponse.ok) {
      // Em desenvolvimento ou durante uma atualização gradual, a rota nova
      // pode não existir ainda. O caminho anterior mantém o envio funcional.
      if (intentResponse.status === 404 || intentResponse.status === 405) return uploadThroughApplication();
      return failFromPayload(intent);
    }

    if (intent.mode === "server") return uploadThroughApplication();
    if (intent.mode === "completed") return complete(intent);
    if (intent.mode !== "direct" || !intent.upload?.url) {
      return failFromPayload({ error: { code: "UPLOAD_SIGNING_FAILED", message: "Não foi possível preparar o envio da foto. Tente novamente." } });
    }

    try {
      const directResponse = await fetch(intent.upload.url, {
        method: intent.upload.method ?? "PUT",
        headers: intent.upload.headers,
        body: uploadingPhoto.file,
      });
      if (!directResponse.ok) return uploadThroughApplication();
    } catch {
      // CORS ou uma falha transitória do storage não impede o caminho legado.
      return uploadThroughApplication();
    }

    const finalizeResponse = await fetch(`${endpoint}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestToken: uploadingPhoto.guestToken,
        uploadId: uploadingPhoto.id,
        originalName: "foto-original",
      }),
    });
    const finalized = await readPayload(finalizeResponse);
    if (finalizeResponse.ok) return complete(finalized);
    if (shouldRetry(finalized.error?.code)) return uploadThroughApplication();
    return failFromPayload(finalized);
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
