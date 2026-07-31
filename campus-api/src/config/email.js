import nodemailer from "nodemailer";
import dns from "node:dns/promises";

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

const configuredEmailHost = process.env.EMAIL_HOST.trim();

// Nodemailer 9 may randomly choose an IPv6 address when a hostname has
// both A and AAAA records. Render's outbound network is IPv4-only on some
// instances, which makes Gmail SMTP fail with ENETUNREACH. Resolve an A
// record explicitly while retaining the hostname for TLS verification.
let emailConnectionHost = configuredEmailHost;

try {
  const ipv4Addresses = await dns.resolve4(configuredEmailHost);

  if (ipv4Addresses.length > 0) {
    emailConnectionHost = ipv4Addresses[0];
  }
} catch (error) {
  console.warn("Unable to resolve an IPv4 address for the email server", {
    host: configuredEmailHost,
    code: error?.code,
    message: error?.message,
  });
}

const emailTransporter =
  nodemailer.createTransport({
    host: emailConnectionHost,
    port: emailPort,
    secure:
      process.env.EMAIL_SECURE === "true",

    tls: {
      servername: configuredEmailHost,
    },

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
