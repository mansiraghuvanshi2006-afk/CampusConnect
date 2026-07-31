import api from "./api.js";

export const ADMIN_CONTACT_EMAIL =
  "mansiraghuvanshi2006@gmail.com";

export const submitContactForm = async ({
  name,
  email,
  subject,
  message,
}) => {
  const response = await api.post("/contact", {
    name,
    email,
    subject,
    message,
  });

  return response.data;
};
