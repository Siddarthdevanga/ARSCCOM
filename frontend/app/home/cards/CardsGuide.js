"use client";
/* ============================================================================
   DIGITAL CARDS GUIDE — the in-page help
   A "Guide" button in each Digital Cards screen's header opens a panel at
   the top of the page: why the module exists, then the steps for the
   screen being looked at. Closed until asked for. The full walkthrough is
   the Digital Cards section of /guide.
   ========================================================================== */
import { BookOpen, X } from "lucide-react";
import styles from "./style.module.css";
import g from "./guide.module.css";

export function GuideButton({ open, onClick }) {
  return (
    <button type="button" className={styles.ghostBtn} onClick={onClick} aria-expanded={open}
            aria-controls="cards-guide">
      <BookOpen size={15} /><span>Guide</span>
    </button>
  );
}

const WHY = (
  <>
    <h3>Why use Digital Cards</h3>
    <ul>
      <li><b>One QR, always up to date.</b> Each card has its own QR. Scanning it opens a web page with the
        person&rsquo;s details, so a change of phone number or title never means reprinting.</li>
      <li><b>Saved in one tap.</b> Whoever scans it can save the contact straight to their phone, call,
        WhatsApp or email.</li>
      <li><b>Leads come back to you.</b> They can also share their own details. Those land in
        <b> Card Leads</b>, and the card owner gets an email.</li>
      <li><b>You see what works.</b> Every card shows how many times it was scanned and how many leads it brought in.</li>
    </ul>
  </>
);

const TWO_WAYS = (
  <>
    <h3>Two ways to make a card</h3>
    <div className={g.ways}>
      <div className={g.way}>
        <b>1. New Card: you fill it in</b>
        <ol>
          <li>Click <b>New Card</b>. You can start from someone in your employee list.</li>
          <li>Add their details, a photo if you like, and pick the colours.</li>
          <li>Click <b>Create card</b>, then <b>Download</b> the print-ready front and back.</li>
        </ol>
      </div>
      <div className={g.way}>
        <b>2. Generate QR cards: each employee fills in their own</b>
        <ol>
          <li>Click <b>Generate QR cards</b>, choose how many and the colours.</li>
          <li>Download the print sheet, print it on card stock and hand the cards out.</li>
          <li>Each employee scans their card and fills in their details. It goes live straight away.</li>
        </ol>
      </div>
    </div>
  </>
);

const CONTENT = {
  list: (
    <>
      {WHY}
      {TWO_WAYS}
      <h3>Buttons on each card</h3>
      <ul className={g.keys}>
        <li><b>QR</b>: show, download or open the card&rsquo;s QR.</li>
        <li><b>Edit</b>: change the details. On an empty card you can fill it in yourself.</li>
        <li><b>Reset</b>: empty a numbered QR card for someone new. The old details and leads are kept on an inactive card.</li>
        <li><b>Delete</b>: removes the card, its QR, scans and leads, and frees the slot. Filled-in details are kept on record. It cannot be undone.</li>
        <li><b>Activate / Deactivate</b>: an inactive card&rsquo;s QR shows &ldquo;not active&rdquo; and frees the slot.</li>
        <li><b>Lock / Release</b>: after a downgrade, lock the cards you don&rsquo;t need to keep within your plan.</li>
      </ul>
      <p className={g.note}>
        Your plan sets how many active cards you can have: Trial 1, Business 5, Enterprise 10.
        Empty QR cards count too. <b>Print empty</b> downloads the sheet of every card not yet filled in.
      </p>
    </>
  ),
  editor: (
    <>
      {WHY}
      <h3>Filling in a card</h3>
      <ol>
        <li><b>Start from an employee</b> (new cards only): pick someone from your employee list to fill in their name, phone and email.</li>
        <li><b>Details</b> and <b>Contact</b>: name and phone are required. Add a photo, and tick whether it goes on the printed card.</li>
        <li><b>Design</b>: pick a dark or light theme, or your own colours. The preview warns if the text is hard to read.</li>
        <li><b>Printed card</b>: shows exactly how both sides will print.</li>
        <li>Click <b>Create card</b> or <b>Save changes</b>. Then <b>Download</b> the print-ready front and back PNGs.</li>
      </ol>
      <p className={g.note}>Changes show on the card&rsquo;s web page straight away. The printed QR never changes, so there is no need to reprint.</p>
    </>
  ),
  leads: (
    <>
      {WHY}
      <h3>Card Leads</h3>
      <ol>
        <li>A lead is someone who scanned one of your cards and tapped <b>Share my details</b>.</li>
        <li>Each lead shows their name, company, message and whose card they scanned. The newest are at the top.</li>
        <li>Use <b>Call</b> or <b>WhatsApp</b> to reply, and search by name, phone, company or card owner.</li>
        <li>Click <b>Export</b> for an Excel file of every lead.</li>
      </ol>
      <p className={g.note}>Deleting a card deletes its leads too. Export first if you need them.</p>
    </>
  ),
};

export default function CardsGuide({ page, open, onClose }) {
  if (!open) return null;
  return (
    <section id="cards-guide" className={g.panel} aria-label="Digital Cards guide">
      <div className={g.head}>
        <span className={g.eyebrow}><BookOpen size={14} /> Digital Cards guide</span>
        <button type="button" className={g.close} onClick={onClose} aria-label="Close guide"><X size={16} /></button>
      </div>
      <div className={g.content}>{CONTENT[page]}</div>
      <a className={g.more} href="/guide#digital-cards" target="_blank" rel="noopener noreferrer">
        Full walkthrough in the User Guide →
      </a>
    </section>
  );
}
