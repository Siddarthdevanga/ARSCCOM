import bcrypt from "bcrypt";
import path from "path";
import { db } from "../config/db.js";
import { uploadToS3 } from "../services/s3.service.js";
import { sendEmail } from "../utils/mailer.js";

const BCRYPT_ROUNDS = 10;
const PASSWORD_MIN_LENGTH = 8;

/* ======================================================
   EMAIL FOOTER
====================================================== */
const emailFooter = () => `
<br/>
Regards,<br/>
<img 
  src="https://arsccom-assets.s3.amazonaws.com/PROMEET/EMAILS%20LOGO.png" 
  alt="PROMEET Logo"
  style="height:65px;margin:10px 0;display:block"
/>
<hr style="border:0;border-top:1px solid #ddd;margin:10px 0;" />
<p style="font-size:13px;color:#666">
This email was automatically sent from the PROMEET Platform.
</p>`;

/* ======================================================
   VALIDATE WHATSAPP URL
====================================================== */
const validateWhatsAppUrl = (url) => {
  if (!url || !url.trim()) return null;
  
  const trimmedUrl = url.trim();
  const whatsappPattern = /^https:\/\/(wa\.me|api\.whatsapp\.com)\/.+/i;
  
  if (!whatsappPattern.test(trimmedUrl)) {
    throw new Error("Invalid WhatsApp URL format. Must start with https://wa.me/ or https://api.whatsapp.com/");
  }
  
  return trimmedUrl;
};

/* ======================================================
   GET SETTINGS
   GET /api/settings
====================================================== */
export const getSettings = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const companyId = req.user?.companyId;

    if (!userId || !companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    // Fetch company data
    const [[company]] = await db.execute(
      `SELECT 
         id,
         name,
         slug,
         logo_url,
         rooms,
         whatsapp_url,
         plan,
         subscription_status
       FROM companies 
       WHERE id = ?`,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found"
      });
    }

    // Fetch user data
    const [[user]] = await db.execute(
      `SELECT 
         id,
         email,
         name,
         phone
       FROM users 
       WHERE id = ? AND company_id = ?`,
      [userId, companyId]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.json({
      success: true,
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        logo_url: company.logo_url,
        rooms: company.rooms,
        whatsapp_url: company.whatsapp_url || null,
        plan: company.plan,
        subscription_status: company.subscription_status
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name || null,
        phone: user.phone || null
      }
    });

  } catch (error) {
    console.error("GET SETTINGS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch settings"
    });
  }
};

/* ======================================================
   UPDATE COMPANY SETTINGS
   PUT /api/settings/company
====================================================== */
export const updateCompanySettings = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const { name, whatsappUrl } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Company name is required"
      });
    }

    // Validate WhatsApp URL (optional field)
    const validatedWhatsAppUrl = validateWhatsAppUrl(whatsappUrl);

    // Update company
    await db.execute(
      `UPDATE companies 
       SET name = ?,
           whatsapp_url = ?
       WHERE id = ?`,
      [name.trim(), validatedWhatsAppUrl, companyId]
    );

    // Fetch updated data
    const [[updated]] = await db.execute(
      `SELECT name, whatsapp_url, logo_url, slug 
       FROM companies 
       WHERE id = ?`,
      [companyId]
    );

    return res.json({
      success: true,
      message: "Company settings updated successfully",
      company: {
        id: companyId,
        name: updated.name,
        slug: updated.slug,
        logo_url: updated.logo_url,
        whatsapp_url: updated.whatsapp_url || null
      }
    });

  } catch (error) {
    console.error("UPDATE COMPANY SETTINGS ERROR:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update company settings"
    });
  }
};

/* ======================================================
   UPDATE COMPANY LOGO
   PUT /api/settings/company/logo
====================================================== */
export const updateCompanyLogo = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Logo file is required"
      });
    }

    // Get company slug for S3 path
    const [[company]] = await db.execute(
      `SELECT slug FROM companies WHERE id = ?`,
      [companyId]
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found"
      });
    }

    // Upload new logo to S3
    const ext = path.extname(req.file.originalname || "").toLowerCase() || ".png";
    const logoKey = `companies/${company.slug}/logo${ext}`;
    const logoUrl = await uploadToS3(req.file, logoKey);

    // Update database
    await db.execute(
      `UPDATE companies 
       SET logo_url = ?
       WHERE id = ?`,
      [logoUrl, companyId]
    );

    return res.json({
      success: true,
      message: "Company logo updated successfully",
      logo_url: logoUrl
    });

  } catch (error) {
    console.error("UPDATE COMPANY LOGO ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update company logo"
    });
  }
};

/* ======================================================
   UPDATE USER PROFILE
   PUT /api/settings/profile
====================================================== */
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const companyId = req.user?.companyId;

    if (!userId || !companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const { name, phone } = req.body;

    // At least one field must be provided
    if (!name && !phone) {
      return res.status(400).json({
        success: false,
        message: "Please provide name or phone to update"
      });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];

    if (name && name.trim()) {
      updates.push("name = ?");
      values.push(name.trim());
    }

    if (phone && phone.trim()) {
      updates.push("phone = ?");
      values.push(phone.trim());
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update"
      });
    }

    values.push(userId);
    values.push(companyId);

    // Update user
    await db.execute(
      `UPDATE users 
       SET ${updates.join(", ")}
       WHERE id = ? AND company_id = ?`,
      values
    );

    // Fetch updated data
    const [[updated]] = await db.execute(
      `SELECT id, email, name, phone 
       FROM users 
       WHERE id = ?`,
      [userId]
    );

    return res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        phone: updated.phone
      }
    });

  } catch (error) {
    console.error("UPDATE USER PROFILE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update profile"
    });
  }
};

/* ======================================================
   CHANGE PASSWORD
   PUT /api/settings/password
====================================================== */
export const changePassword = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const companyId = req.user?.companyId;

    if (!userId || !companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required"
      });
    }

    // Validate new password length
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`
      });
    }

    // Fetch user with current password hash
    const [[user]] = await db.execute(
      `SELECT 
         u.id,
         u.password_hash,
         u.email,
         c.name AS company_name
       FROM users u
       JOIN companies c ON c.id = u.company_id
       WHERE u.id = ? AND u.company_id = ?`,
      [userId, companyId]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect"
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password
    await db.execute(
      `UPDATE users 
       SET password_hash = ?
       WHERE id = ?`,
      [newPasswordHash, userId]
    );

    // Send confirmation email (non-blocking)
    sendPasswordChangedEmail(user.email, user.company_name).catch(console.error);

    return res.json({
      success: true,
      message: "Password changed successfully"
    });

  } catch (error) {
    console.error("CHANGE PASSWORD ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to change password"
    });
  }
};

/* ======================================================
   SEND PASSWORD CHANGED EMAIL
====================================================== */
const sendPasswordChangedEmail = async (email, companyName) => {
  await sendEmail({
    to: email,
    subject: "PROMEET — Password Successfully Changed",
    html: `
      <p>Hello <b>${companyName}</b>,</p>

      <p>
        This email confirms that your PROMEET account password has been 
        <b style="color:#00c853;">successfully changed</b>.
      </p>

      <div style="background:#e8f5e9;border-left:4px solid #00c853;padding:16px;margin:20px 0;">
        <p style="margin:0;color:#2e7d32;font-weight:600;">
          ✓ Your password has been updated securely
        </p>
      </div>

      <h3 style="color:#6c2bd9;margin-top:30px;margin-bottom:10px;">
        Important Security Notice
      </h3>

      <p>
        <b style="color:#ff1744;">Did you make this change?</b>
      </p>

      <ul style="font-size:14px;line-height:1.8;">
        <li>
          <b>If yes:</b> No further action required. Your account is secure.
        </li>
        <li>
          <b>If no:</b> Someone may have unauthorized access. 
          Please contact support <b>immediately</b>.
        </li>
      </ul>

      ${emailFooter()}
    `
  });
};
