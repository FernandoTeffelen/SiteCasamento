import type { Metadata, Viewport } from "next";
import { AccountFormFeedback } from "@/features/account/account-form-feedback";
import "./style/index.css";

export const metadata: Metadata = {
  title: "Jogo de Fotos",
  description: "Jogo de fotos para casamentos.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fffaf7",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <AccountFormFeedback />
        {children}
      </body>
    </html>
  );
}
