export type WeddingVisualConfig = {
  colors: {
    background: string;
    surface: string;
    primary: string;
    primaryForeground: string;
    accent: string;
    text: string;
    mutedText: string;
  };
  fonts: {
    heading: "serif" | "sans" | "modern";
    body: "sans" | "serif" | "modern";
  };
  assets: {
    coverImageUrl: string | null;
    logoImageUrl: string | null;
  };
  texts: {
    eventKicker: string;
    welcomeTitle: string;
    welcomeDescription: string;
  };
};

export type WeddingVisualOverrides = {
  colors?: Partial<WeddingVisualConfig["colors"]>;
  fonts?: Partial<WeddingVisualConfig["fonts"]>;
  assets?: Partial<WeddingVisualConfig["assets"]>;
  texts?: Partial<WeddingVisualConfig["texts"]>;
};

export const defaultWeddingVisualConfig: WeddingVisualConfig = {
  colors: {
    background: "#fffaf8",
    surface: "#ffffff",
    primary: "#a95954",
    primaryForeground: "#ffffff",
    accent: "#bf756d",
    text: "#3e2528",
    mutedText: "#755e60",
  },
  fonts: { heading: "serif", body: "sans" },
  assets: { coverImageUrl: null, logoImageUrl: null },
  texts: {
    eventKicker: "Nosso casamento",
    welcomeTitle: "Que alegria ter você aqui!",
    welcomeDescription: "Entre no nosso jogo de fotos e ajude a guardar os momentos mais especiais deste dia.",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : undefined;
}

function validFont(value: unknown) {
  return value === "serif" || value === "sans" || value === "modern" ? value : undefined;
}

function validAssetUrl(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  if (value.startsWith("/")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function validText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : undefined;
}

function withoutUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

/** Discards unsupported properties so visual settings cannot inject arbitrary CSS or HTML. */
export function normalizeWeddingVisualOverrides(value: unknown): WeddingVisualOverrides {
  if (!isRecord(value)) return {};
  const colors = isRecord(value.colors) ? value.colors : {};
  const fonts = isRecord(value.fonts) ? value.fonts : {};
  const assets = isRecord(value.assets) ? value.assets : {};
  const texts = isRecord(value.texts) ? value.texts : {};

  return {
    colors: withoutUndefined({
      background: validColor(colors.background),
      surface: validColor(colors.surface),
      primary: validColor(colors.primary),
      primaryForeground: validColor(colors.primaryForeground),
      accent: validColor(colors.accent),
      text: validColor(colors.text),
      mutedText: validColor(colors.mutedText),
    }),
    fonts: withoutUndefined({ heading: validFont(fonts.heading), body: validFont(fonts.body) }),
    assets: withoutUndefined({ coverImageUrl: validAssetUrl(assets.coverImageUrl), logoImageUrl: validAssetUrl(assets.logoImageUrl) }),
    texts: withoutUndefined({
      eventKicker: validText(texts.eventKicker, 40),
      welcomeTitle: validText(texts.welcomeTitle, 100),
      welcomeDescription: validText(texts.welcomeDescription, 280),
    }),
  };
}

export function resolveWeddingVisualConfig(templateConfig: unknown, overrides: unknown): WeddingVisualConfig {
  const template = normalizeWeddingVisualOverrides(templateConfig);
  const base: WeddingVisualConfig = {
    colors: { ...defaultWeddingVisualConfig.colors, ...template.colors },
    fonts: { ...defaultWeddingVisualConfig.fonts, ...template.fonts },
    assets: { ...defaultWeddingVisualConfig.assets, ...template.assets },
    texts: { ...defaultWeddingVisualConfig.texts, ...template.texts },
  };
  const customization = normalizeWeddingVisualOverrides(overrides);
  return {
    colors: { ...base.colors, ...customization.colors },
    fonts: { ...base.fonts, ...customization.fonts },
    assets: { ...base.assets, ...customization.assets },
    texts: { ...base.texts, ...customization.texts },
  };
}

export function visualConfigToCssVariables(config: WeddingVisualConfig) {
  const headingFont = config.fonts.heading === "serif"
    ? 'Georgia, "Times New Roman", serif'
    : config.fonts.heading === "modern"
      ? '"Trebuchet MS", "Segoe UI", sans-serif'
      : '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const bodyFont = config.fonts.body === "serif"
    ? 'Georgia, "Times New Roman", serif'
    : config.fonts.body === "modern"
      ? '"Trebuchet MS", "Segoe UI", sans-serif'
      : '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  return {
    "--wedding-background": config.colors.background,
    "--wedding-surface": config.colors.surface,
    "--wedding-primary": config.colors.primary,
    "--wedding-primary-foreground": config.colors.primaryForeground,
    "--wedding-accent": config.colors.accent,
    "--wedding-text": config.colors.text,
    "--wedding-muted-text": config.colors.mutedText,
    "--wedding-heading-font": headingFont,
    "--wedding-body-font": bodyFont,
  };
}
