/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type WeddingQrCodeProps = {
  publicId: string;
  weddingName: string;
};

export function WeddingQrCode({ publicId, weddingName }: WeddingQrCodeProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [copied, setCopied] = useState(false);

  const weddingUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/w/${encodeURIComponent(publicId)}`;
  }, [publicId]);

  useEffect(() => {
    if (!weddingUrl) return;

    let isCurrent = true;

    void QRCode.toDataURL(weddingUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 480,
      color: { dark: "#302029", light: "#fffdfb" },
    })
      .then((dataUrl) => {
        if (isCurrent) setImageUrl(dataUrl);
      })
      .catch(() => {
        if (isCurrent) setHasError(true);
      });

    return () => {
      isCurrent = false;
    };
  }, [weddingUrl]);

  async function copyLink() {
    if (!weddingUrl) return;

    try {
      await navigator.clipboard.writeText(weddingUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // O campo abaixo continua permitindo que a pessoa copie o link manualmente.
    }
  }

  return (
    <div className="wedding-qr-code">
      <div className="wedding-qr-image-frame" aria-live="polite">
        {imageUrl ? (
          <img src={imageUrl} alt={`QR Code do casamento ${weddingName}`} className="wedding-qr-image" />
        ) : hasError ? (
          <p className="wedding-qr-error">Não foi possível gerar o QR Code. Use o link abaixo.</p>
        ) : (
          <span className="wedding-qr-loading">Gerando QR Code...</span>
        )}
      </div>

      <label className="wedding-qr-link-label" htmlFor={`wedding-link-${publicId}`}>
        Link privado dos convidados
      </label>
      <input id={`wedding-link-${publicId}`} className="wedding-qr-link" value={weddingUrl} readOnly onClick={(event) => event.currentTarget.select()} />

      <div className="wedding-qr-actions">
        <button type="button" className="wedding-qr-copy-button" onClick={() => void copyLink()}>
          {copied ? "Link copiado" : "Copiar link"}
        </button>
        {imageUrl && (
          <a className="wedding-qr-download-link" href={imageUrl} download={`qr-code-${publicId}.png`}>
            Baixar QR Code
          </a>
        )}
      </div>
    </div>
  );
}
