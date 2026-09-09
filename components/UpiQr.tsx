"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * A QR for the UPI deep link.
 *
 * The link alone is enough on a phone — tapping it opens GPay or PhonePe
 * with the amount already filled. On a laptop it does nothing at all, and
 * a laptop is where somebody buying advertising usually is. The QR is what
 * bridges that: they scan it with the phone that has their UPI app.
 *
 * Rendered in the browser rather than fetched from a QR service, because
 * the alternative is handing a third party a URL containing the payee id
 * and amount of every advertiser who reaches this step.
 */
export default function UpiQr({ value, size = 148 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size * 2, // rendered at 2x so it stays sharp on a retina screen
      margin: 1,
      errorCorrectionLevel: "M",
      // Ink on cream rather than black on white: a pure white tile on this
      // page reads as a hole punched in the card.
      color: { dark: "#2b1608", light: "#fffdf8" },
    })
      .then((url) => !cancelled && setDataUrl(url))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (failed) return null;

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-[0.9rem] border border-[var(--ink-line)] bg-[#fffdf8]"
      style={{ width: size, height: size }}
    >
      {dataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="UPI payment QR code" width={size} height={size} />
      )}
    </div>
  );
}
