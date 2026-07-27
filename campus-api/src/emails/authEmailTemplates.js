const escapeHtml = (value = "") =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  
  export const createVerificationEmailTemplate = ({
    name,
    verificationUrl,
    role,
    expirationMinutes,
  }) => {
    const safeName = escapeHtml(name);
    const safeVerificationUrl =
      escapeHtml(verificationUrl);
  
    const roleMessage =
      role === "teacher"
        ? "After email verification, your teacher account will wait for administrator approval."
        : "After email verification, your student account will become active.";
  
    return {
      subject: "Verify your CampusConnect email",
  
      text: `
  Hello ${name},
  
  Thank you for registering with CampusConnect.
  
  Verify your email using this link:
  
  ${verificationUrl}
  
  This link expires in ${expirationMinutes} minutes.
  
  ${roleMessage}
  
  If you did not create this account, ignore this email.
      `.trim(),
  
      html: `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1.0"
            />
            <title>Verify your email</title>
          </head>
  
          <body
            style="
              margin: 0;
              padding: 24px;
              background: #f1f5f9;
              font-family: Arial, sans-serif;
              color: #0f172a;
            "
          >
            <div
              style="
                max-width: 600px;
                margin: 0 auto;
                background: #ffffff;
                padding: 32px;
                border-radius: 12px;
              "
            >
              <h1 style="margin-top: 0">
                CampusConnect
              </h1>
  
              <h2>Verify your email address</h2>
  
              <p>Hello ${safeName},</p>
  
              <p>
                Thank you for registering with
                CampusConnect.
              </p>
  
              <p>
                Click the button below to verify
                your email address.
              </p>
  
              <p style="margin: 28px 0">
                <a
                  href="${safeVerificationUrl}"
                  style="
                    display: inline-block;
                    padding: 12px 20px;
                    background: #2563eb;
                    color: #ffffff;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: bold;
                  "
                >
                  Verify Email
                </a>
              </p>
  
              <p>
                This link expires in
                ${expirationMinutes} minutes.
              </p>
  
              <p>${roleMessage}</p>
  
              <p
                style="
                  color: #64748b;
                  font-size: 13px;
                  word-break: break-all;
                "
              >
                If the button does not work, use
                this link:
                <br />
                ${safeVerificationUrl}
              </p>
            </div>
          </body>
        </html>
      `,
    };
  };
  
  export const createWelcomeEmailTemplate = ({
    name,
    role,
  }) => {
    const safeName = escapeHtml(name);
  
    const accountMessage =
      role === "teacher"
        ? "Your teacher account has been verified and approved."
        : "Your student account has been verified and activated.";
  
    return {
      subject: "Welcome to CampusConnect",
  
      text: `
  Hello ${name},
  
  Welcome to CampusConnect.
  
  ${accountMessage}
  
  You can now log in and use your account.
      `.trim(),
  
      html: `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1.0"
            />
            <title>Welcome to CampusConnect</title>
          </head>
  
          <body
            style="
              margin: 0;
              padding: 24px;
              background: #f1f5f9;
              font-family: Arial, sans-serif;
              color: #0f172a;
            "
          >
            <div
              style="
                max-width: 600px;
                margin: 0 auto;
                background: #ffffff;
                padding: 32px;
                border-radius: 12px;
              "
            >
              <h1 style="margin-top: 0">
                CampusConnect
              </h1>
  
              <h2>Welcome, ${safeName}!</h2>
  
              <p>${accountMessage}</p>
  
              <p>
                You can now log in and start using
                CampusConnect.
              </p>
            </div>
          </body>
        </html>
      `,
    };
  };