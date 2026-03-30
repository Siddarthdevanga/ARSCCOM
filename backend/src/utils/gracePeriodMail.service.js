import { sendEmail } from "./mailer.js";

/* ======================================================
   EMAIL FOOTER (CONSISTENT BRANDING)
====================================================== */
const emailFooter = (companyName) => `
<br/>
<hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
<p style="font-size: 13px; color: #666; line-height: 1.6;">
  Regards,<br/>
  <b>PROMEET Team</b>
</p>
<p style="font-size: 12px; color: #999; margin-top: 20px;">
  This is an automated notification regarding your subscription for <b>${companyName}</b>.
  If you have any questions, please contact our support team.
</p>
`;

/* ======================================================
   GET EMAIL CONTENT BASED ON DAY
====================================================== */
const getEmailContent = (day, companyName, gracePeriodEndsAt, planType) => {
  const daysRemaining = 11 - day;
  const formattedDate = new Date(gracePeriodEndsAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const urgencyColor = day <= 3 ? "#DC2626" : day <= 7 ? "#F59E0B" : "#D97706";
  const urgencyEmoji = day <= 3 ? "🚨" : day <= 7 ? "⚠️" : "⏰";

  const content = {
    1: {
      subject: "⚠️ Subscription Expired - 10 Days Grace Period Started",
      heading: "Your Subscription Has Expired",
      message: `
        <p style="font-size: 16px; color: #333; line-height: 1.8;">
          Your <b>${planType.toUpperCase()}</b> subscription has expired. However, we've activated a
          <b style="color: #D97706;">10-day grace period</b> for you.
        </p>
        <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <p style="margin: 0; font-size: 15px; color: #92400E;">
            <b>Grace Period Active:</b> You can continue using visitor management and conference booking
            features for the next <b>10 days</b>.
          </p>
        </div>
        <p style="font-size: 15px; color: #333;">
          <b>Grace period ends on:</b> <span style="color: #D97706; font-weight: bold;">${formattedDate}</span>
        </p>
        <p style="font-size: 15px; color: #666; margin-top: 20px;">
          To avoid service interruption, please renew your subscription as soon as possible.
        </p>
      `,
    },
    2: {
      subject: "⏰ Grace Period Day 2 - 9 Days Remaining",
      heading: "Grace Period Active - Day 2",
      message: `
        <p style="font-size: 16px; color: #333;">
          Your grace period is active. You have <b style="color: #D97706;">9 days remaining</b> to renew your subscription.
        </p>
        <div style="background: #FEF3C7; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #92400E; font-size: 15px;">
            <b>Days Remaining:</b> 9 days<br/>
            <b>Grace Period Ends:</b> ${formattedDate}
          </p>
        </div>
      `,
    },
    3: {
      subject: "⏰ Grace Period Day 3 - 8 Days Remaining",
      heading: "Grace Period Day 3",
      message: `
        <p style="font-size: 16px; color: #333;">
          You have <b style="color: #D97706;">8 days remaining</b> in your grace period.
        </p>
        <p style="font-size: 15px; color: #666;">
          Renew your subscription before <b>${formattedDate}</b> to continue uninterrupted access.
        </p>
      `,
    },
    4: {
      subject: "⏰ Grace Period Day 4 - 7 Days Remaining",
      heading: "Grace Period Day 4",
      message: `
        <p style="font-size: 16px; color: #333;">
          <b style="color: #D97706;">7 days remaining</b> in your grace period.
        </p>
        <p style="font-size: 15px; color: #666;">
          Don't wait until the last moment. Renew today to ensure continuous service.
        </p>
      `,
    },
    5: {
      subject: "⚠️ Halfway Through Grace Period - 6 Days Remaining",
      heading: "Grace Period - Halfway Point",
      message: `
        <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 16px; color: #92400E;">
            <b>⚠️ You're halfway through your grace period!</b>
          </p>
          <p style="margin-top: 10px; color: #92400E;">
            Only <b>6 days remaining</b> before your account is suspended.
          </p>
        </div>
        <p style="font-size: 15px; color: #333;">
          <b>Grace period ends:</b> ${formattedDate}
        </p>
        <p style="font-size: 15px; color: #666; margin-top: 20px;">
          Please renew your subscription to avoid service interruption.
        </p>
      `,
    },
    6: {
      subject: "⏰ Grace Period Day 6 - 5 Days Remaining",
      heading: "5 Days Left in Grace Period",
      message: `
        <p style="font-size: 16px; color: #F59E0B;">
          <b>Only 5 days remaining!</b> Your grace period ends on <b>${formattedDate}</b>.
        </p>
        <p style="font-size: 15px; color: #666; margin-top: 20px;">
          Renew now to ensure continuous access to your visitor and conference management system.
        </p>
      `,
    },
    7: {
      subject: "⚠️ 4 Days Left in Grace Period",
      heading: "Grace Period Ending Soon",
      message: `
        <div style="background: #FEF3C7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 17px; color: #F59E0B; font-weight: bold;">
            ⚠️ Only 4 days remaining!
          </p>
        </div>
        <p style="font-size: 15px; color: #333;">
          Your account will be suspended on <b>${formattedDate}</b> if not renewed.
        </p>
      `,
    },
    8: {
      subject: "🚨 Only 3 Days Remaining - Urgent Action Required!",
      heading: "Urgent: 3 Days Left",
      message: `
        <div style="background: #FEE2E2; border-left: 4px solid #DC2626; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 18px; color: #DC2626; font-weight: bold;">
            🚨 URGENT: Only 3 days remaining!
          </p>
          <p style="margin-top: 10px; color: #991B1B;">
            Your account will be suspended on <b>${formattedDate}</b>
          </p>
        </div>
        <p style="font-size: 15px; color: #333; margin-top: 20px;">
          <b>Action Required:</b> Renew your subscription immediately to avoid losing access.
        </p>
      `,
    },
    9: {
      subject: "🚨 Final 2 Days - Renew Now to Avoid Suspension!",
      heading: "Critical: 2 Days Remaining",
      message: `
        <div style="background: #FEE2E2; border: 2px solid #DC2626; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 18px; color: #DC2626; font-weight: bold;">
            🚨 CRITICAL: Only 2 days left!
          </p>
          <p style="margin-top: 10px; font-size: 16px; color: #991B1B;">
            Your grace period ends on <b>${formattedDate}</b>
          </p>
          <p style="margin-top: 10px; color: #991B1B;">
            After that, you will <b>lose access</b> to all features until you renew.
          </p>
        </div>
        <p style="font-size: 15px; color: #333; margin-top: 20px;">
          <b>Don't wait!</b> Renew your subscription now.
        </p>
      `,
    },
    10: {
      subject: "🚨 LAST DAY - Account Will Be Suspended Tomorrow!",
      heading: "FINAL WARNING: Last Day of Grace Period",
      message: `
        <div style="background: #DC2626; color: white; padding: 24px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; font-size: 20px; font-weight: bold;">
            🚨 THIS IS YOUR LAST DAY! 🚨
          </p>
          <p style="margin-top: 12px; font-size: 16px;">
            Your account will be <b>SUSPENDED TOMORROW</b>
          </p>
          <p style="margin-top: 8px; font-size: 15px;">
            Grace period ends: <b>${formattedDate}</b>
          </p>
        </div>
        <div style="background: #FEE2E2; border-left: 4px solid #DC2626; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 16px; color: #991B1B;">
            <b>What happens tomorrow:</b>
          </p>
          <ul style="color: #991B1B; margin-top: 10px; line-height: 1.8;">
            <li>All visitor management features will be disabled</li>
            <li>Conference room bookings will be suspended</li>
            <li>You will lose access to the dashboard</li>
            <li>All your data will be preserved but inaccessible</li>
          </ul>
        </div>
        <p style="font-size: 16px; color: #333; margin-top: 24px; text-align: center;">
          <b style="color: #DC2626;">RENEW NOW TO PREVENT SUSPENSION!</b>
        </p>
      `,
    },
    11: {
      subject: "❌ Account Suspended - Immediate Renewal Required",
      heading: "Your Account Has Been Suspended",
      message: `
        <div style="background: #DC2626; color: white; padding: 24px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; font-size: 20px; font-weight: bold;">
            ❌ ACCOUNT SUSPENDED
          </p>
          <p style="margin-top: 12px; font-size: 15px;">
            Your 10-day grace period has ended
          </p>
        </div>
        <div style="background: #FEE2E2; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 16px; color: #991B1B;">
            <b>Your account is now suspended. All features have been disabled:</b>
          </p>
          <ul style="color: #991B1B; margin-top: 10px; line-height: 1.8;">
            <li>Visitor management is disabled</li>
            <li>Conference room bookings are disabled</li>
            <li>Dashboard access is restricted</li>
          </ul>
        </div>
        <div style="background: #DBEAFE; border-left: 4px solid #3B82F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 15px; color: #1E40AF;">
            <b>Good News:</b> Your data is safe! All your visitor records, conference bookings,
            and settings are preserved and will be restored immediately upon renewal.
          </p>
        </div>
        <p style="font-size: 16px; color: #333; margin-top: 24px; text-align: center;">
          <b>Renew your subscription now to restore access.</b>
        </p>
        <p style="font-size: 14px; color: #666; margin-top: 16px; text-align: center;">
          Need help? Contact our support team at support@promeet.com
        </p>
      `,
    },
  };

  return content[day] || content[11];
};

/* ======================================================
   SEND GRACE PERIOD EMAIL
====================================================== */
export const sendGracePeriodEmail = async ({
  companyName,
  adminEmail,
  day,
  gracePeriodEndsAt,
  planType = "trial",
}) => {
  try {
    if (!adminEmail) {
      console.warn("[GRACE PERIOD EMAIL] No admin email provided");
      return;
    }

    const { subject, heading, message } = getEmailContent(
      day,
      companyName,
      gracePeriodEndsAt,
      planType
    );

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #7a00ff; margin: 0; font-size: 28px;">PROMEET</h1>
          <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">Visitor & Conference Management</p>
        </div>

        <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-top: 0; font-size: 24px;">${heading}</h2>

          <p style="font-size: 15px; color: #333; margin-bottom: 20px;">
            Hello <b>${companyName}</b>,
          </p>

          ${message}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_FRONTEND_URL || "https://www.promeet.zodopt.com"}/auth/subscription"
               style="display: inline-block; background: linear-gradient(135deg, #7a00ff 0%, #a855f7 100%);
                      color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px;
                      font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(122, 0, 255, 0.3);">
              Renew Subscription Now
            </a>
          </div>

          ${emailFooter(companyName)}
        </div>

        <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
          © ${new Date().getFullYear()} PROMEET. All rights reserved.
        </p>
      </div>
    `;

    await sendEmail({
      to: adminEmail,
      subject,
      html,
    });

    console.log(`✅ [GRACE PERIOD] Day ${day} email sent to: ${adminEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ [GRACE PERIOD EMAIL] Day ${day} error:`, error.message);
    return false;
  }
};
