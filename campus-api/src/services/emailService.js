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
  });
};

export const sendVerificationEmail =
  async ({
    user,
    rawToken,
    expirationMinutes,
  }) => {
    const clientUrl =
      process.env.CLIENT_URL;

    if (!clientUrl) {
      throw new Error(
        "CLIENT_URL is missing"
      );
    }

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