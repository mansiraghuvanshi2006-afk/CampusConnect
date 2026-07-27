import {
  FiBookOpen,
  FiMessageCircle,
  FiShield,
  FiUsers,
} from "react-icons/fi";
import { Link } from "react-router-dom";

import campusLogo from "../../assets/campus-logo.png";

const values = [
  {
    title: "Community First",
    description:
      "Every feature is built around real campus relationships between students, teachers and departments.",
    icon: FiUsers,
  },
  {
    title: "Organized Communication",
    description:
      "Department spaces and structured chats keep conversations focused and easy to follow.",
    icon: FiMessageCircle,
  },
  {
    title: "Academic Focus",
    description:
      "Teachers can guide discussions, share resources and support students in one secure place.",
    icon: FiBookOpen,
  },
  {
    title: "Trusted Access",
    description:
      "Role-based permissions and admin oversight keep your campus community safe and verified.",
    icon: FiShield,
  },
];

const AboutPage = () => {
  return (
    <>
      <section className="campus-gradient campus-grid relative overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
        <div className="absolute left-10 top-16 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />

        <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-purple-500/20 blur-3xl" />

        <div className="relative mx-auto max-w-5xl text-center">
          <img
            src={campusLogo}
            alt="CampusConnect"
            className="mx-auto h-24 w-24 object-contain drop-shadow-2xl"
          />

          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-blue-300">
            About us
          </p>

          <h1 className="mt-4 text-4xl font-black sm:text-5xl">
            Connecting your{" "}
            <span className="gradient-text">campus community</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-blue-100/70 sm:text-lg">
            CampusConnect is a communication platform designed to help
            students, teachers and administrators connect through organized
            campus and department communities.
          </p>
        </div>
      </section>

      <section className="campus-grid bg-[#11142f] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
          <article className="glass-card rounded-3xl p-8">
            <p className="text-sm font-semibold uppercase tracking-widest text-purple-300">
              Our mission
            </p>

            <h2 className="mt-3 text-2xl font-bold text-white">
              Make campus communication simple
            </h2>

            <p className="mt-4 leading-7 text-blue-100/65">
              We believe every student deserves a clear, organized way to stay
              connected with classmates, teachers and campus departments — without
              the noise of scattered group chats and missed announcements.
            </p>
          </article>

          <article className="glass-card rounded-3xl p-8">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-300">
              Our vision
            </p>

            <h2 className="mt-3 text-2xl font-bold text-white">
              One platform for every department
            </h2>

            <p className="mt-4 leading-7 text-blue-100/65">
              From first-year orientation to final-year projects, CampusConnect
              grows with your campus — bringing structured spaces, verified
              access and real-time messaging under one roof.
            </p>
          </article>
        </div>
      </section>

      <section className="campus-gradient campus-grid relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-300">
              What we stand for
            </p>

            <h2 className="mt-3 text-3xl font-bold text-white">
              Built on strong values
            </h2>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {values.map((value) => {
              const Icon = value.icon;

              return (
                <article
                  key={value.title}
                  className="glass-card group rounded-2xl p-6 transition duration-300 hover:-translate-y-1 hover:border-purple-400/40"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 text-blue-200 transition group-hover:scale-110">
                    <Icon size={23} />
                  </div>

                  <h3 className="mt-5 text-lg font-bold text-white">
                    {value.title}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-blue-100/65">
                    {value.description}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="mt-14 text-center">
            <Link
              to="/register"
              className="gradient-button inline-flex items-center justify-center rounded-xl px-8 py-3.5 font-semibold text-white shadow-lg shadow-purple-950/30 transition hover:-translate-y-0.5"
            >
              Join CampusConnect
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

export default AboutPage;
