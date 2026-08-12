/**
 * One-time backfill: computes and stores a visitor-code prefix for every
 * existing company that doesn't have one yet (companies registered before
 * this feature shipped). Does not touch historical visitor codes — only
 * sets companies.code_prefix so future check-ins use a real prefix instead
 * of the generic "CMP" fallback.
 *
 * Run once after the add-company-code-prefix.sql migration:
 *   node backend/src/scripts/backfillCodePrefix.js
 *
 * db.js creates its MySQL pool at import time using process.env.DB_*, and
 * those values come from AWS Secrets Manager via loadSecrets() (not from
 * .env) — same as server.js's own startup sequence. So loadSecrets() must
 * run, and env vars must be populated, BEFORE db.js is ever imported;
 * dynamic import() (not a static import at the top of this file) is what
 * makes that ordering possible.
 */
import "dotenv/config";
import { loadSecrets } from "../config/secrets.js";
import { deriveCodePrefix } from "../utils/codePrefix.js";

const run = async () => {
  await loadSecrets();
  const { db } = await import("../config/db.js");

  const [companies] = await db.query(
    `SELECT id, name FROM companies WHERE code_prefix IS NULL OR code_prefix = ''`
  );

  console.log(`Found ${companies.length} companies without a code_prefix.`);

  for (const company of companies) {
    const prefix = deriveCodePrefix(company.name);
    await db.query(`UPDATE companies SET code_prefix = ? WHERE id = ?`, [prefix, company.id]);
    console.log(`  #${company.id} "${company.name}" -> ${prefix}`);
  }

  console.log("Done.");
  process.exit(0);
};

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
