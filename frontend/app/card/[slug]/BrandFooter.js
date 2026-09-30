import Link from "next/link";
import styles from "./style.module.css";

/* "Digital card by" + the Hai Visitor logo and wordmark, under every card
   page. Links to the home page: the card is also how people find us. */
export default function BrandFooter({ className, label = "Digital card by" }) {
  return (
    <p className={`${styles.brandFooter} ${className || ""}`}>
      <span>{label}</span>
      <Link href="/" className={styles.brandFooterLink} aria-label="Hai Visitor">
        <img src="/v-mark.png" alt="" width="20" height="20" />
        <span>H<b>ai</b> Visitor</span>
      </Link>
    </p>
  );
}
