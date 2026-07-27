import campusLogo from "../../assets/campus-logo.png";

const PrivacyPage = () => {
  return (
    <section className="campus-gradient campus-grid relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
      <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />

      <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-purple-500/15 blur-3xl" />

      <div className="relative mx-auto max-w-4xl">
        <div className="text-center">
          <img
            src={campusLogo}
            alt="CampusConnect"
            className="mx-auto h-20 w-20 object-contain"
          />

          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.3em] text-blue-300">
            Legal
          </p>

          <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">
            Privacy Policy
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-blue-100/65">
            Learn how CampusConnect collects, uses and protects your
            information.
          </p>
        </div>

        <article className="glass-card mt-10 space-y-8 rounded-3xl p-7 sm:p-10">
          <section>
            <h2 className="text-xl font-bold text-white">
              1. Information we collect
            </h2>

            <p className="mt-3 leading-7 text-blue-100/65">
              CampusConnect may collect information such as your name,
              email address, account role, department, profile details
              and messages you choose to send through the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">
              2. How we use your information
            </h2>

            <p className="mt-3 leading-7 text-blue-100/65">
              We use account information to provide authentication,
              department access, teacher approval, campus communication
              and administrative management.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">
              3. Account security
            </h2>

            <p className="mt-3 leading-7 text-blue-100/65">
              Passwords are stored in hashed form. Access to protected
              features is controlled using authenticated sessions,
              access tokens and role-based permissions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">
              4. Messages and campus content
            </h2>

            <p className="mt-3 leading-7 text-blue-100/65">
              Messages and other content may be stored so they can be
              delivered to members of the relevant department or campus
              community. Users should not share sensitive personal
              information in public channels.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">
              5. Information sharing
            </h2>

            <p className="mt-3 leading-7 text-blue-100/65">
              CampusConnect does not sell personal information.
              Information may be visible to authorized administrators,
              teachers or users when required for the platform to
              function.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">
              6. Contact
            </h2>

            <p className="mt-3 leading-7 text-blue-100/65">
              For privacy-related questions, contact:
            </p>

            <a
              href="mailto:mansiraghuvanshi2006@gmail.com"
              className="mt-2 inline-flex text-purple-300 hover:text-purple-200"
            >
              mansiraghuvanshi2006@gmail.com
            </a>
          </section>

          <p className="border-t border-white/10 pt-6 text-sm text-blue-100/45">
            Last updated: July 2026
          </p>
        </article>
      </div>
    </section>
  );
};

export default PrivacyPage;