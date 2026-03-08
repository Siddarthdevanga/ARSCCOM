import express from "express";
import { db } from "../config/db.js";

const router = express.Router();

/* ======================================================
   EMPLOYEE EMAIL RESPONSE — ACCEPT OR DECLINE
   GET /api/visit-response/:token/:action
   — No auth required (one-time token from email)
====================================================== */
router.get("/:token/:action", async (req, res) => {
  const { token, action } = req.params;

  if (!["accept", "decline"].includes(action)) {
    return res.status(400).send(renderPage("Invalid Action", "The action you requested is not valid.", "#f44336"));
  }

  try {
    const [[visitor]] = await db.execute(
      `SELECT id, name, visit_status, response_token_expires_at, employee_id
       FROM visitors
       WHERE response_token = ?
       LIMIT 1`,
      [token]
    );

    if (!visitor) {
      return res.status(404).send(renderPage(
        "Link Not Found",
        "This response link is invalid or has already been used.",
        "#f44336"
      ));
    }

    // Token expiry check
    if (new Date(visitor.response_token_expires_at) < new Date()) {
      return res.status(410).send(renderPage(
        "Link Expired",
        "This response link has expired (48 hours). The admin can still update the status from the dashboard.",
        "#ff9800"
      ));
    }

    // Already responded
    if (visitor.visit_status !== "pending") {
      const label = visitor.visit_status.charAt(0).toUpperCase() + visitor.visit_status.slice(1);
      return res.send(renderPage(
        "Already Responded",
        `This visit has already been marked as <b>${label}</b>.`,
        "#6c2bd9"
      ));
    }

    const newStatus = action === "accept" ? "accepted" : "declined";

    await db.execute(
      `UPDATE visitors
       SET visit_status = ?, response_token = NULL
       WHERE id = ?`,
      [newStatus, visitor.id]
    );

    const isAccepted = newStatus === "accepted";

    return res.send(renderPage(
      isAccepted ? "Visit Accepted ✅" : "Visit Declined ❌",
      isAccepted
        ? `You have <b>accepted</b> the visit from <b>${visitor.name}</b>. Reception has been notified.`
        : `You have <b>declined</b> the visit from <b>${visitor.name}</b>. Reception has been notified.`,
      isAccepted ? "#00c853" : "#f44336"
    ));

  } catch (err) {
    console.error("[VISIT_RESPONSE] Error:", err);
    return res.status(500).send(renderPage("Error", "Something went wrong. Please contact your administrator.", "#f44336"));
  }
});

/* ======================================================
   SIMPLE HTML RESPONSE PAGE (no frontend dependency)
====================================================== */
const renderPage = (title, message, color) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Promeet</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #f5f3ff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 40px 36px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 4px 24px rgba(108,43,217,0.10);
    }
    .icon {
      font-size: 56px;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 24px;
      color: ${color};
      margin-bottom: 16px;
    }
    p {
      font-size: 16px;
      color: #555;
      line-height: 1.6;
    }
    .badge {
      display: inline-block;
      margin-top: 24px;
      padding: 6px 16px;
      background: ${color}18;
      color: ${color};
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
    }
    .footer {
      margin-top: 32px;
      font-size: 12px;
      color: #aaa;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🏢</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="badge">Promeet Visitor Management</div>
    <div class="footer">You can now close this window.</div>
  </div>
</body>
</html>
`;

export default router;
