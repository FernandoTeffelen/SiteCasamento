import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "../src/server/db/prisma";

const baseUrl = (process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const customerEmail = `smoke-${suffix}@example.test`;
const customerPassword = "smoke1234";
const customerCookies = new Map<string, string>();
const platformCookies = new Map<string, string>();
const checks: string[] = [];

type SmokePayload = {
  status?: string;
  user: { id: string; platformRole: string };
  organization: { balance: number };
  wedding: { status: string; publicId: string };
  guest: { token: string; name: string };
  missions: Array<{ id: string }>;
  pagination: { total: number };
  awardedNow: boolean;
};

function getSetCookies(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  return headers.getSetCookie?.() ?? (response.headers.get("set-cookie") ? [response.headers.get("set-cookie")!] : []);
}

function saveCookies(jar: Map<string, string>, response: Response) {
  for (const cookie of getSetCookies(response)) {
    const firstPart = cookie.split(";", 1)[0];
    const separator = firstPart.indexOf("=");
    if (separator > 0) jar.set(firstPart.slice(0, separator), firstPart.slice(separator + 1));
  }
}

async function request(
  path: string,
  options: { method?: string; body?: unknown; cookies?: Map<string, string> } = {},
) {
  const headers = new Headers();
  if (options.method && options.method !== "GET") headers.set("Origin", baseUrl);
  if (options.cookies?.size) {
    headers.set("Cookie", [...options.cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; "));
  }

  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${path}`, { method: options.method ?? "GET", headers, body, redirect: "manual" });
  if (options.cookies) saveCookies(options.cookies, response);
  const contentType = response.headers.get("content-type") ?? "";
  const text = contentType.startsWith("image/") ? "" : await response.text();
  let payload = {} as SmokePayload;
  try { payload = (text ? JSON.parse(text) : {}) as SmokePayload; } catch { payload = {} as SmokePayload; }
  return { response, payload };
}

function check(condition: boolean, label: string, detail?: unknown) {
  assert.ok(condition, `${label}${detail === undefined ? "" : `: ${JSON.stringify(detail)}`}`);
  checks.push(label);
  console.log(`PASS ${label}`);
}

function createPhotoForm(guestToken: string, uploadId: string) {
  const bytes = new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1]);
  const form = new FormData();
  form.set("guestToken", guestToken);
  form.set("uploadId", uploadId);
  form.set("photo", new Blob([bytes], { type: "image/jpeg" }), "smoke.jpg");
  return form;
}

let customerId = "";
let weddingId = "";
let publicId = "";

try {
  assert.ok(process.env.PLATFORM_ADMIN_EMAIL && process.env.PLATFORM_ADMIN_PASSWORD, "Configure PLATFORM_ADMIN_EMAIL/PASSWORD para o smoke test.");

  const health = await request("/api/health");
  check(health.response.status === 200 && health.payload.status === "ok", "health check da aplicação");

  const registration = await request("/api/admin/auth/register", {
    method: "POST",
    cookies: customerCookies,
    body: { name: `Cliente Smoke ${suffix}`, email: customerEmail, password: customerPassword, customerType: "CEREMONIALIST" },
  });
  check(registration.response.status === 200 && typeof registration.payload.user?.id === "string", "cadastro de cliente", registration.payload);
  customerId = registration.payload.user.id;

  const logout = await request("/api/admin/auth/logout", { method: "POST", cookies: customerCookies });
  check(logout.response.status === 303, "logout do cliente");

  const login = await request("/api/admin/auth/login", {
    method: "POST",
    cookies: customerCookies,
    body: { email: customerEmail, password: customerPassword },
  });
  check(login.response.status === 200 && login.payload.user.id === customerId, "login do cliente");

  const platformLogin = await request("/api/platform/auth/login", {
    method: "POST",
    cookies: platformCookies,
    body: { email: process.env.PLATFORM_ADMIN_EMAIL, password: process.env.PLATFORM_ADMIN_PASSWORD },
  });
  check(platformLogin.response.status === 200 && platformLogin.payload.user.platformRole === "PLATFORM_ADMIN", "login do administrador");

  const membership = await prisma.organizationMembership.findFirstOrThrow({ where: { userId: customerId }, select: { organizationId: true } });
  const planForm = new FormData();
  planForm.set("organizationId", membership.organizationId);
  planForm.set("durationMonths", "1");
  planForm.set("creditsPerMonth", "2");
  planForm.set("startDate", new Date().toISOString().slice(0, 10));
  planForm.set("status", "ACTIVE");
  planForm.set("adjustmentMode", "EXTEND");
  const plan = await request(`/api/platform/customers/${customerId}/manual-plans`, { method: "POST", cookies: platformCookies, body: planForm });
  check(plan.response.status === 303, "liberação manual de plano");

  const dashboard = await request("/api/admin/weddings", { cookies: customerCookies });
  check(dashboard.response.status === 200 && dashboard.payload.organization.balance === 2, "geração de créditos");

  const weddingCreate = await request("/api/admin/weddings", {
    method: "POST",
    cookies: customerCookies,
    body: { name: `Casamento Smoke ${suffix}`, brideName: "Ana Smoke", groomName: "Bruno Smoke", eventDate: "2030-10-18" },
  });
  check(weddingCreate.response.status === 201 && weddingCreate.payload.wedding.status === "ACTIVE", "criação e ativação do casamento");
  publicId = weddingCreate.payload.wedding.publicId;
  weddingId = (await prisma.wedding.findUniqueOrThrow({ where: { publicId }, select: { id: true } })).id;

  const afterActivation = await request("/api/admin/weddings", { cookies: customerCookies });
  check(afterActivation.payload.organization.balance === 1, "utilização de um crédito");
  const secondWedding = await request("/api/admin/weddings", {
    method: "POST",
    cookies: customerCookies,
    body: { name: "Segundo casamento Smoke", brideName: "Segundo", groomName: "Crédito", eventDate: "2030-10-19" },
  });
  check(secondWedding.response.status === 201, "utilização do segundo crédito");
  const afterSecondActivation = await request("/api/admin/weddings", { cookies: customerCookies });
  check(afterSecondActivation.payload.organization.balance === 0, "saldo zerado após utilizar os créditos");
  const noCreditWedding = await request("/api/admin/weddings", {
    method: "POST",
    cookies: customerCookies,
    body: { name: "Casamento sem crédito", brideName: "Sem", groomName: "Crédito", eventDate: "2030-10-20" },
  });
  check(noCreditWedding.response.status === 409, "bloqueio ao tentar usar crédito indisponível");

  const publicEvent = await request(`/api/events/${publicId}`);
  check(publicEvent.response.status === 200 && !Object.hasOwn(publicEvent.payload.wedding, "id"), "acesso pelo token do QR Code");

  const guestCreate = await request(`/api/events/${publicId}/guests`, {
    method: "POST",
    body: { name: "Convidado Smoke", email: `guest-${suffix}@example.test` },
  });
  check(guestCreate.response.status === 201 && typeof guestCreate.payload.guest.token === "string", "cadastro do convidado");
  const guestToken = guestCreate.payload.guest.token as string;

  const missions = await request(`/api/events/${publicId}/missions?guestToken=${encodeURIComponent(guestToken)}`);
  check(missions.response.status === 200 && missions.payload.missions.length > 0, "missões disponíveis");
  const missionId = missions.payload.missions[0].id as string;

  const profileForm = new FormData();
  profileForm.set("guestToken", guestToken);
  profileForm.set("name", "Convidado Smoke Atualizado");
  profileForm.set("email", `guest-${suffix}@example.test`);
  profileForm.set("age", "32");
  profileForm.set("relationshipToCouple", "Amigo");
  const profile = await request(`/api/events/${publicId}/guests/me`, { method: "PATCH", body: profileForm });
  check(profile.response.status === 200 && profile.payload.guest.name === "Convidado Smoke Atualizado", "perfil do convidado");

  const uploadId = `smoke-${suffix.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const upload = await request(`/api/events/${publicId}/missions/${missionId}/submissions`, {
    method: "POST",
    body: createPhotoForm(guestToken, uploadId),
  });
  check(upload.response.status === 201 && upload.payload.awardedNow === true, "captura e upload da foto");
  const repeatedUpload = await request(`/api/events/${publicId}/missions/${missionId}/submissions`, {
    method: "POST",
    body: createPhotoForm(guestToken, uploadId),
  });
  check(repeatedUpload.response.status === 201 && repeatedUpload.payload.awardedNow === false, "prevenção de duplicidade");

  const photo = await prisma.photo.findFirstOrThrow({ where: { weddingId }, select: { id: true } });
  const gallery = await request(`/api/admin/weddings/${weddingId}/gallery?page=1&pageSize=24`, { cookies: customerCookies });
  check(gallery.response.status === 200 && gallery.payload.pagination.total === 1, "galeria administrativa paginada");
  const photoResponse = await request(`/api/admin/photos/${photo.id}`, { cookies: customerCookies });
  check(photoResponse.response.status === 200 && photoResponse.response.headers.get("content-type")?.startsWith("image/jpeg") === true, "acesso administrativo à foto");

  await prisma.wedding.update({ where: { id: weddingId }, data: { publicAccessEndsAt: new Date(Date.now() - 1_000) } });
  const expired = await request(`/api/events/${publicId}`);
  check(expired.response.status === 403, "expiração do acesso público");
  await prisma.wedding.update({ where: { id: weddingId }, data: { publicAccessEndsAt: new Date(Date.now() + 86_400_000) } });

  const revoked = await request(`/api/admin/weddings/${weddingId}/public-access`, { method: "PATCH", cookies: customerCookies, body: { revoked: true } });
  check(revoked.response.status === 200, "encerramento/revogação do casamento");
  const afterRevoke = await request(`/api/events/${publicId}`);
  check(afterRevoke.response.status === 403, "bloqueio após revogação");
  await request(`/api/admin/weddings/${weddingId}/public-access`, { method: "PATCH", cookies: customerCookies, body: { revoked: false } });

  console.log(`SMOKE_OK ${checks.length} verificações`);
} finally {
  if (customerId) {
    await prisma.user.deleteMany({ where: { id: customerId, email: customerEmail } });
  }
  await prisma.$disconnect();
}
