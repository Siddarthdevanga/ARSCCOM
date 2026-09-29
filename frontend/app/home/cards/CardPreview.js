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
  scale = PREVIEW_SCALE,
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

  /* Each keystroke starts a new render, and a render waits on image loads
     part-way through. Drawing straight onto the visible canvas let two
     renders interleave, so text from an older keystroke landed on top of
     the newer one. Each render draws off-screen and only the latest is
     copied in. */
  useEffect(() => {
    let cancelled = false;
    const show = (target, source) => {
      if (cancelled || !target) return;
      target.width = source.width;
      target.height = source.height;
      target.getContext("2d").drawImage(source, 0, 0);
    };
    (async () => {
      const front = await drawFront(document.createElement("canvas"), card, { scale, logoSrc, photoSrc });
      show(frontRef.current, front);
      if (cancelled) return;
      const back = await drawBack(document.createElement("canvas"), card, { scale, qrSrc });
      show(backRef.current, back);
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [card, logoSrc, photoSrc, qrSrc, scale]);

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
