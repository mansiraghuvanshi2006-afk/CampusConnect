/** Admin inbox for public contact form submissions (always receives contact mail). */
export const ADMIN_CONTACT_EMAIL =
  process.env.CONTACT_ADMIN_EMAIL?.trim() ||
  "mansiraghuvanshi2006@gmail.com";
