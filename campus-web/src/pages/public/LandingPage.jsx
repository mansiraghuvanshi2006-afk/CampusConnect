import {
  FiArrowRight,
  FiBookOpen,
  FiMessageCircle,
  FiShield,
  FiUserPlus,
  FiUsers,
  FiZap,
} from "react-icons/fi";
import { Link } from "react-router-dom";

import campusLogo from "../../assets/campus-logo.png";

const features = [
  {
    title: "Department Communities",
    description:
      "Join your department and communicate with students and teachers.",
    icon: FiUsers,
  },
  {
    title: "Campus Chat",
    description:
      "Participate in organized campus and department-based conversations.",
    icon: FiMessageCircle,
  },
  {
    title: "Teacher Access",
    description:
      "Verified teachers can guide students and manage academic discussions.",
    icon: FiBookOpen,
  },
  {
    title: "Secure Administration",
    description:
      "Administrators approve teachers and manage users and departments.",
    icon: FiShield,
  },
];

const steps = [
  {
    step: "01",
    title: "Create your account",
    description: "Register as a student or teacher with your campus email.",
    icon: FiUserPlus,
  },
  {
    step: "02",
    title: "Join your department",
    description: "Get placed into the right community spaces for your course.",
    icon: FiUsers,
  },
  {
    step: "03",
    title: "Start connecting",
    description: "Chat, collaborate and stay updated with your campus in real time.",
    icon: FiZap,
  },
];

const LandingPage = () => {
  return (
    <>
      <section className="campus-gradient campus-grid relative overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
        <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />

        <div className="absolute -right-24 top-10 h-96 w-96 rounded-full bg-purple-500/25 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2">
          <div>
            <div className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-blue-100 backdrop-blur">
              Built for students, teachers and campus communities
            </div>

            <h1 className="mt-7 text-4xl font-black leading-tight text-white sm:text-6xl">
              Connect, learn and grow with your{" "}
              <span className="gradient-text">campus community</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-blue-100/75 sm:text-lg">
              Join secure department spaces, chat with classmates, connect with
              teachers and stay updated with everything happening across your
              campus.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <Link
                to="/register"
                className="gradient-button inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 font-semibold text-white shadow-lg shadow-purple-900/30 transition hover:-translate-y-0.5"
              >
                Create account
                <FiArrowRight />
              </Link>

              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-7 py-3.5 font-semibold text-white backdrop-blur transition hover:bg-white/10"
              >
                Sign in
              </Link>
            </div>
          </div>

          <div className="relative flex justify-center">
            <div className="absolute h-80 w-80 rounded-full bg-purple-500/25 blur-3xl" />

            <div className="glass-card relative w-full max-w-md rounded-3xl p-8">
              <img
                src={campusLogo}
                alt="CampusConnect"
                className="mx-auto h-44 w-44 object-contain drop-shadow-2xl"
              />

              <div className="mt-7 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-white/5 bg-white/5 p-4 transition hover:border-purple-400/30 hover:bg-white/10">
                  <p className="text-xl font-bold">24/7</p>

                  <p className="mt-1 text-xs text-blue-100/60">Campus access</p>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/5 p-4 transition hover:border-purple-400/30 hover:bg-white/10">
                  <p className="text-xl font-bold">Live</p>

                  <p className="mt-1 text-xs text-blue-100/60">Messaging</p>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/5 p-4 transition hover:border-purple-400/30 hover:bg-white/10">
                  <p className="text-xl font-bold">Safe</p>

                  <p className="mt-1 text-xs text-blue-100/60">Communities</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="campus-grid bg-[#11142f] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-300">
              Campus collaboration
            </p>

            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
              Everything your{" "}
              <span className="gradient-text">campus needs</span>
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-blue-100/65">
              Connect users, organize departments and create focused spaces for
              academic communication.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <article
                  key={feature.title}
                  className="glass-card group rounded-2xl p-6 transition duration-300 hover:-translate-y-2 hover:border-purple-400/40"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 text-blue-200 transition group-hover:scale-110">
                    <Icon size={23} />
                  </div>

                  <h3 className="mt-5 text-lg font-bold text-white">
                    {feature.title}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-blue-100/65">
                    {feature.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="campus-gradient campus-grid relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
        <div className="absolute right-10 top-10 h-64 w-64 rounded-full bg-blue-400/15 blur-3xl" />

        <div className="relative mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-purple-300">
              How it works
            </p>

            <h2 className="mt-3 text-3xl font-bold text-white">
              Get started in three simple steps
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((item) => {
              const Icon = item.icon;

              return (
                <article
                  key={item.step}
                  className="glass-card group relative rounded-2xl p-6 transition duration-300 hover:-translate-y-1 hover:border-purple-400/40"
                >
                  <span className="text-xs font-bold uppercase tracking-widest text-purple-300/70">
                    Step {item.step}
                  </span>

                  <div className="mt-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 text-blue-200 transition group-hover:scale-110">
                    <Icon size={20} />
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-white">
                    {item.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-blue-100/65">
                    {item.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="campus-gradient campus-grid relative overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
        <div className="absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/20 blur-3xl" />

        <div className="absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-blue-400/15 blur-3xl" />

        <div className="relative mx-auto max-w-4xl">
          <div className="glass-card rounded-3xl p-10 text-center sm:p-14">
            <img
              src={campusLogo}
              alt="CampusConnect"
              className="mx-auto h-20 w-20 object-contain"
            />

            <h2 className="mt-6 text-3xl font-bold text-white sm:text-4xl">
              Ready to join{" "}
              <span className="gradient-text">CampusConnect</span>?
            </h2>

            <p className="mx-auto mt-4 max-w-xl text-blue-100/65">
              Create your student or teacher account and connect with your campus
              community today.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/register"
                className="gradient-button inline-flex items-center justify-center gap-2 rounded-xl px-8 py-3.5 font-semibold text-white shadow-lg shadow-purple-950/30 transition hover:-translate-y-0.5"
              >
                Get started
                <FiArrowRight />
              </Link>

              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-8 py-3.5 font-semibold text-white backdrop-blur transition hover:bg-white/10"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default LandingPage;
