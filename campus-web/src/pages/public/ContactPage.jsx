import { useState } from "react";
import {
  FiClock,
  FiMail,
  FiMapPin,
  FiSend,
} from "react-icons/fi";
import toast from "react-hot-toast";

import campusLogo from "../../assets/campus-logo.png";

const contactDetails = [
  {
    title: "Support email",
    value: "mansiraghuvanshi2006@gmail.com",
    description: "We usually reply within 24 hours on working days.",
    icon: FiMail,
  },
  {
    title: "Campus hours",
    value: "Mon – Fri, 9 AM – 6 PM",
    description: "Live support available during campus office hours.",
    icon: FiClock,
  },
  {
    title: "Location",
    value: "Campus Connect HQ",
    description: "Onboarding and partnership inquiries welcome.",
    icon: FiMapPin,
  },
];

const ContactPage = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const name = formData.get("name");
    const email = formData.get("email");
    const subject = formData.get("subject");
    const message = formData.get("message");

    const mailtoLink = `mailto:mansiraghuvanshi2006@gmail.com?subject=${encodeURIComponent(
      `[CampusConnect] ${subject}`
    )}&body=${encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\n${message}`
    )}`;

    window.location.href = mailtoLink;
    toast.success("Opening your email app to send the message");
    setIsSubmitting(false);
    event.currentTarget.reset();
  };

  return (
    <>
      <section className="campus-gradient campus-grid relative overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
        <div className="absolute left-16 top-20 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />

        <div className="absolute bottom-10 right-16 h-80 w-80 rounded-full bg-purple-500/20 blur-3xl" />

        <div className="relative mx-auto max-w-5xl text-center">
          <img
            src={campusLogo}
            alt="CampusConnect"
            className="mx-auto h-24 w-24 object-contain drop-shadow-2xl"
          />

          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-blue-300">
            Contact
          </p>

          <h1 className="mt-4 text-4xl font-black sm:text-5xl">
            We&apos;d love to{" "}
            <span className="gradient-text">hear from you</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-blue-100/70">
            For help, feedback or campus onboarding, reach out to the
            CampusConnect support team. We&apos;re here to help your community
            get started.
          </p>
        </div>
      </section>

      <section className="campus-grid bg-[#11142f] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-3">
          {contactDetails.map((detail) => {
            const Icon = detail.icon;

            return (
              <article
                key={detail.title}
                className="glass-card group rounded-2xl p-6 transition duration-300 hover:-translate-y-1 hover:border-purple-400/40"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 text-blue-200">
                  <Icon size={22} />
                </div>

                <p className="mt-5 text-xs font-bold uppercase tracking-wide text-blue-100/50">
                  {detail.title}
                </p>

                <p className="mt-2 font-semibold text-white">{detail.value}</p>

                <p className="mt-2 text-sm leading-6 text-blue-100/60">
                  {detail.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="campus-gradient campus-grid relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/15 blur-3xl" />

        <div className="relative mx-auto max-w-2xl">
          <div className="glass-card rounded-3xl p-8 sm:p-10">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">
                Send us a message
              </h2>

              <p className="mt-2 text-sm text-blue-100/65">
                Fill in the form and we&apos;ll open your email app with the
                message ready to send.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-8 space-y-5"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="contact-name"
                    className="mb-2 block text-xs font-bold uppercase tracking-wide text-blue-100/65"
                  >
                    Your name
                  </label>

                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    required
                    placeholder="Your full name"
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="contact-email"
                    className="mb-2 block text-xs font-bold uppercase tracking-wide text-blue-100/65"
                  >
                    Email
                  </label>

                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@college.edu"
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="contact-subject"
                  className="mb-2 block text-xs font-bold uppercase tracking-wide text-blue-100/65"
                >
                  Subject
                </label>

                <input
                  id="contact-subject"
                  name="subject"
                  type="text"
                  required
                  placeholder="How can we help?"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                />
              </div>

              <div>
                <label
                  htmlFor="contact-message"
                  className="mb-2 block text-xs font-bold uppercase tracking-wide text-blue-100/65"
                >
                  Message
                </label>

                <textarea
                  id="contact-message"
                  name="message"
                  required
                  rows={5}
                  placeholder="Tell us about your campus or question..."
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="gradient-button inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white shadow-lg shadow-purple-950/30 transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                <FiSend size={18} />
                {isSubmitting ? "Opening email..." : "Send message"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
};

export default ContactPage;
