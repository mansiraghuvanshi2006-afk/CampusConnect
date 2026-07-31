import nodemailer from "nodemailer";

const requiredEmailVariables = [
  "EMAIL_HOST",
  "EMAIL_PORT",
  "EMAIL_USER",
  "EMAIL_PASSWORD",
  "EMAIL_FROM_ADDRESS",
];

const validateEmailEnvironment = () => {
  const missingVariables =
    requiredEmailVariables.filter(
      (variableName) =>
        !process.env[variableName]
    );

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing email environment variables: ${missingVariables.join(
        ", "
      )}`
    );
  }
};

validateEmailEnvironment();

const emailPort = Number.parseInt(
  process.env.EMAIL_PORT,
  10
);

if (!Number.isInteger(emailPort)) {
  throw new Error(
    "EMAIL_PORT must be a valid number"
  );
}

// Gmail app passwords are shown with spaces but must be used without them.
const emailPassword =
  process.env.EMAIL_PASSWORD?.replace(/\s/g, "") || "";

const emailTransporter =
  nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: emailPort,
    secure:
      process.env.EMAIL_SECURE === "true",

    auth: {
      user: process.env.EMAIL_USER,
      pass: emailPassword,
    },

    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

export const verifyEmailTransporter =
  async () => {
    await emailTransporter.verify();

    console.log(
      "Email server connection verified"
    );
  };

export default emailTransporter;