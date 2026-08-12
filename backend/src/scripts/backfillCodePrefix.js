/**
 * One-time backfill: computes and stores a visitor-code prefix for every
 * existing company that doesn't have one yet (companies registered before
 * this feature shipped). Does not touch historical visitor codes — only
 * sets companies.code_prefix so future check-ins use a real prefix instead
 * of the generic "CMP" fallback.
 *
 * Run once after the add-company-code-prefix.sql migration:
 *   node backend/src/scripts/backfillCodePrefix.js
 */
import { db } from "../config/db.js";
import { deriveCodePrefix } from "../utils/codePrefix.js";

const run = async () => {
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
