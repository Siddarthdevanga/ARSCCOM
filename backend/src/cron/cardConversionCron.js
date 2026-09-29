/**
 * cron/cardConversionCron.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Moves claimed QR pool cards into the company their owner has since paid
 * for, matched on the claim's email or phone. Polled rather than hooked
 * into each payment path: there are several (landing trial, subscription,
 * renewals, billing sync), and a missed hook would strand a card silently.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { convertMatchingCards } from "../services/cardPool.service.js";

let running = false;

export const convertClaimedCards = async () => {
  if (running) return;
  running = true;
  try {
    const n = await convertMatchingCards();
    if (n) console.log(`🪪 QR cards moved into paid accounts: ${n}`);
  } finally {
    running = false;
  }
};
