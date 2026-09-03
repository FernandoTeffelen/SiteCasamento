import type { WeddingVisualConfig } from "@/lib/templates/wedding-visual-config";

export type EventView = {
  identifier: string;
  publicPath: string;
  publicId: string;
  slug: string | null;
  name: string;
  brideName: string;
  groomName: string;
  visual: WeddingVisualConfig;
};
