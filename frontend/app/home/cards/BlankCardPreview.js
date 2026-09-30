"use client";
/* ============================================================================
   EMPTY QR CARD PREVIEW — both faces
   The printed card a company hands out, drawn by the same routine as the
   print sheet's layout (drawCompanyBlankFront/Back), so the preview shows
   what comes out of the printer.
   ========================================================================== */
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { drawCompanyBlankFront, drawCompanyBlankBack, CARD_W, CARD_H } from "./cardArt";
import { QR_OPTS } from "./cardDownload";
import styles from "./preview.module.css";

/* `card` carries the colours (theme and overrides); `cardUrl` is what the
   QR opens: a real card's address, or any address for a sample. */
export default function BlankCardPreview({ companyName = "", logoSrc = "", card, cardUrl, scale = 0.46, side = false, footer = true, brand = false }) {
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

  // Drawn off-screen and copied in, so a slower older render never lands
  // on top of a newer one (as in CardPreview).
  useEffect(() => {
    let cancelled = false;
    const show = (target, source) => {
      if (cancelled || !target) return;
      target.width = source.width;
      target.height = source.height;
      target.getContext("2d").drawImage(source, 0, 0);
    };
    (async () => {
      const front = await drawCompanyBlankFront(document.createElement("canvas"), { name: companyName, card }, { scale, logoSrc, brand });
      show(frontRef.current, front);
      if (cancelled) return;
      const back = await drawCompanyBlankBack(document.createElement("canvas"), { card }, { scale, qrSrc, footer });
      show(backRef.current, back);
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [companyName, logoSrc, card, qrSrc, scale, footer, brand]);

  return (
    <div className={`${styles.wrap} ${side ? styles.side : ""}`}>
      <div className={styles.faces}>
        <figure className={styles.face}>
          <canvas ref={frontRef} className={styles.canvas}
                  style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }} aria-label="Card front preview" />
          <figcaption>Front</figcaption>
        </figure>
        <figure className={styles.face}>
          <canvas ref={backRef} className={styles.canvas}
                  style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }} aria-label="Card back preview" />
          <figcaption>Back</figcaption>
        </figure>
      </div>
    </div>
  );
}
