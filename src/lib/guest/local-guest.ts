const GUEST_NAME_PREFIX = "jogo-de-fotos:guest-name";

function getGuestNameKey(eventPublicId: string) {
  return `${GUEST_NAME_PREFIX}:${eventPublicId}`;
}

export function getLocalGuestName(eventPublicId: string) {
  return localStorage.getItem(getGuestNameKey(eventPublicId))?.trim() ?? "";
}

export function saveLocalGuestName(eventPublicId: string, name: string) {
  localStorage.setItem(getGuestNameKey(eventPublicId), name.trim());
}

export function getLocalGuestToken(eventPublicId: string) {
  return localStorage.getItem(`${getGuestNameKey(eventPublicId)}:token`) ?? "";
}

export function getLocalGuestEmail(eventPublicId: string) {
  return localStorage.getItem(`${getGuestNameKey(eventPublicId)}:email`)?.trim() ?? "";
}

export function saveLocalGuest(eventPublicId: string, guest: { name: string; email?: string | null; token: string }) {
  saveLocalGuestName(eventPublicId, guest.name);
  localStorage.setItem(`${getGuestNameKey(eventPublicId)}:token`, guest.token);
  if (guest.email) localStorage.setItem(`${getGuestNameKey(eventPublicId)}:email`, guest.email);
}
