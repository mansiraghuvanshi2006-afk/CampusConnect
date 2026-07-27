import campusLogo from "../../assets/campus-logo.png";

const TermsPage = () => {
  return (
    <section className="campus-gradient campus-grid relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
      <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />

      <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-purple-500/15 blur-3xl" />

      <div className="relative mx-auto max-w-4xl">
        <div className="text-center">
          <img
            src={campusLogo}
            alt="CampusConnect"
            className="mx-auto h-20 w-20 object-contain"
          />

          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.3em] text-purple-300">
            Legal
          </p>

          <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">
            Terms of Use
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-blue-100/65">
            These terms explain the rules for using CampusConnect.
          </p>
        </div>

        <article className="glass-card mt-10 space-y-8 rounded-3xl p-7 sm:p-10">
          <section>
            <h2 className="text-xl font-bold text-white">
              1. Acceptance of terms
            </h2>

            <p className="mt-3 leading-7 text-blue-100/65">
              By creating an account or using CampusConnect, you agree
              to follow these terms and all applicable campus rules.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">
              2. Account responsibility
            </h2>

            <p className="mt-3 leading-7 text-blue-100/65">
              You are responsible for keeping your login credentials
              private and for all activity performed through your
              account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">
              3. Acceptable use
            </h2>

            <p className="mt-3 leading-7 text-blue-100/65">
              You must use CampusConnect respectfully. Harassment,
              impersonation, spam, abusive content and unauthorized
              access attempts are not allowed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">
              4. Teacher accounts
            </h2>

            <p className="mt-3 leading-7 text-blue-100/65">
              Teacher accounts require administrator approval.
              CampusConnect may reject, suspend or disable accounts
              that cannot be verified or that violate platform rules.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">
              5. Content responsibility
            </h2>

            <p className="mt-3 leading-7 text-blue-100/65">
              Users are responsible for the messages, files and content
              they share. Do not upload unlawful, harmful or copyrighted
              material without permission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">
              6. Account suspension
            </h2>

            <p className="mt-3 leading-7 text-blue-100/65">
              Administrators may suspend or disable accounts when
              necessary to protect users, campus communities or the
              platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">
              7. Service availability
            </h2>

            <p className="mt-3 leading-7 text-blue-100/65">
              CampusConnect may occasionally be unavailable because of
              maintenance, updates or technical issues. Continuous
              availability is not guaranteed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white">
              8. Contact
            </h2>

            <p className="mt-3 leading-7 text-blue-100/65">
              For questions about these terms, contact:
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

export default TermsPage;