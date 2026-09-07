const GUEST_NAME_PREFIX = "jogo-de-fotos:guest-name";

export type LocalGuestAccount = { name: string; email: string | null; token: string };

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

function getSavedGuestsKey(eventPublicId: string) {
  return `${getGuestNameKey(eventPublicId)}:accounts`;
}

export function getSavedLocalGuests(eventPublicId: string): LocalGuestAccount[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(getSavedGuestsKey(eventPublicId)) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is LocalGuestAccount => (
      typeof item === "object" && item !== null
      && typeof (item as LocalGuestAccount).name === "string"
      && typeof (item as LocalGuestAccount).token === "string"
      && (typeof (item as LocalGuestAccount).email === "string" || (item as LocalGuestAccount).email === null)
    )).slice(0, 12);
  } catch {
    return [];
  }
}

export function clearActiveLocalGuest(eventPublicId: string) {
  localStorage.removeItem(getGuestNameKey(eventPublicId));
  localStorage.removeItem(`${getGuestNameKey(eventPublicId)}:token`);
  localStorage.removeItem(`${getGuestNameKey(eventPublicId)}:email`);
}

export function saveLocalGuest(eventPublicId: string, guest: { name: string; email?: string | null; token: string }) {
  saveLocalGuestName(eventPublicId, guest.name);
  localStorage.setItem(`${getGuestNameKey(eventPublicId)}:token`, guest.token);
  if (guest.email) localStorage.setItem(`${getGuestNameKey(eventPublicId)}:email`, guest.email);
  else localStorage.removeItem(`${getGuestNameKey(eventPublicId)}:email`);

  const account: LocalGuestAccount = { name: guest.name.trim(), email: guest.email?.trim() || null, token: guest.token };
  const otherAccounts = getSavedLocalGuests(eventPublicId).filter((item) => item.token !== account.token);
  localStorage.setItem(getSavedGuestsKey(eventPublicId), JSON.stringify([account, ...otherAccounts].slice(0, 12)));
}
