import emailTransporter from
  "../config/email.js";

const getSender = () => {
  const senderName =
    process.env.EMAIL_FROM_NAME ||
    "CampusConnect";

  const senderAddress =
    process.env.EMAIL_FROM_ADDRESS;

  return `"${senderName}" <${senderAddress}>`;
};

export const sendEmail = async ({
  to,
  subject,
  text,
  html,
  replyTo,
}) => {
  if (!to) {
    throw new Error(
      "Email recipient is required"
    );
  }

  if (!subject) {
    throw new Error(
      "Email subject is required"
    );
  }

  return emailTransporter.sendMail({
    from: getSender(),
    to,
    subject,
    text,
    html,
    ...(replyTo ? { replyTo } : {}),
  });
};

export const sendVerificationEmail =
  async ({
    user,
    rawToken,
    expirationMinutes,
  }) => {
    const rawClientUrl =
      process.env.CLIENT_URL;

    if (!rawClientUrl) {
      throw new Error(
        "CLIENT_URL is missing"
      );
    }

    const clientUrl = rawClientUrl
      .trim()
      .replace(/\/+$/, "")
      .replace(/\/admin(\/login)?$/i, "");

    const verificationUrl =
      `${clientUrl}/verify-email` +
      `?token=${encodeURIComponent(rawToken)}`;

    const {
      createVerificationEmailTemplate,
    } = await import(
      "../emails/authEmailTemplates.js"
    );

    const email =
      createVerificationEmailTemplate({
        name: user.name,
        role: user.role,
        verificationUrl,
        expirationMinutes,
      });

    return sendEmail({
      to: user.email,
      ...email,
    });
  };

export const sendWelcomeEmail =
  async (user) => {
    const {
      createWelcomeEmailTemplate,
    } = await import(
      "../emails/authEmailTemplates.js"
    );

    const email =
      createWelcomeEmailTemplate({
        name: user.name,
        role: user.role,
      });

    return sendEmail({
      to: user.email,
      ...email,
    });
  };

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export const sendContactFormEmail = async ({
  name,
  email,
  subject,
  message,
}) => {
  const { ADMIN_CONTACT_EMAIL } = await import(
    "../constants/contactEmail.js"
  );

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replaceAll(
    "\n",
    "<br />"
  );

  const mailSubject = `[CampusConnect Contact] ${subject}`;

  const text = [
    "New CampusConnect contact form submission",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Subject: ${subject}`,
    "",
    "Message:",
    message,
  ].join("\n");

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <body style="font-family: Arial, sans-serif; color: #0f172a;">
        <h2>New contact form message</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap;">${safeMessage}</p>
      </body>
    </html>
  `.trim();

  return sendEmail({
    to: ADMIN_CONTACT_EMAIL,
    subject: mailSubject,
    text,
    html,
    replyTo: email,
  });
};