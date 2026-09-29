"use client";
/* ============================================================================
   CARD PREVIEW — both faces
   Draws through the same routine that produces the downloadable PNG, at a
   smaller scale. What is on screen is therefore exactly what comes out of
   the printer, rather than a CSS approximation of it.
   ========================================================================== */
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";
import { drawFront, drawBack, CARD_W, CARD_H } from "./cardArt";
import { fileBase, QR_OPTS } from "./cardDownload";
import styles from "./preview.module.css";

/* Enough resolution to judge the layout without rendering a 1004px canvas
   on every keystroke. */
const PREVIEW_SCALE = 0.46;

/* Downloading is owned by the editor, which has a second Download button in
   its header: one handler and one busy flag, so the two can never race. */
export default function CardPreview({
  card, cardUrl, logoSrc, photoSrc = "", downloadable = false, onDownload, downloading = false, blockedNote = "",
}) {
  const frontRef = useRef(null);
  const backRef  = useRef(null);
  const [qrSrc, setQrSrc] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!cardUrl) return;
    QRCode.toDataURL(cardUrl, QR_OPTS)
      .then((url) => { if (!cancelled) setQrSrc(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [cardUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (frontRef.current) await drawFront(frontRef.current, card, { scale: PREVIEW_SCALE, logoSrc, photoSrc });
      if (cancelled) return;
      if (backRef.current)  await drawBack(backRef.current, card, { scale: PREVIEW_SCALE, qrSrc });
    })();
    return () => { cancelled = true; };
  }, [card, logoSrc, photoSrc, qrSrc]);

  return (
    <div className={styles.wrap}>
      <div className={styles.faces}>
        <figure className={styles.face}>
          <canvas
            ref={frontRef}
            className={styles.canvas}
            style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }}
            aria-label="Card front preview"
          />
          <figcaption>Front</figcaption>
        </figure>

        <figure className={styles.face}>
          <canvas
            ref={backRef}
            className={styles.canvas}
            style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }}
            aria-label="Card back preview"
          />
          <figcaption>Back</figcaption>
        </figure>
      </div>

      {downloadable && (
        <div className={styles.downloads}>
          <button type="button" onClick={onDownload} disabled={downloading || !!blockedNote}>
            <Download size={14} /> {downloading ? "Preparing…" : "Download front & back"}
          </button>
          <span className={styles.spec}>
            {fileBase(card.name)}-front.png, {fileBase(card.name)}-back.png · 85 × 55 mm · 300 dpi
          </span>
          {blockedNote && <p className={styles.note} role="status">{blockedNote}</p>}
        </div>
      )}
    </div>
  );
}
