import campusLogo from "../../assets/campus-logo.png";
import developerPhoto from "../../assets/developer-photo.jpg";

const technologies = [
  "React",
  "Node.js",
  "MongoDB",
  "Express",
  "Socket.IO",
  "Tailwind CSS",
];

const DeveloperPage = () => {
  return (
    <section className="campus-gradient campus-grid relative overflow-hidden px-4 py-24 sm:px-6">
      <div className="absolute left-20 top-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="absolute bottom-10 right-20 h-80 w-80 rounded-full bg-purple-500/20 blur-3xl" />

      <div className="relative mx-auto max-w-5xl">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-300">
            Developer
          </p>

          <h1 className="mt-4 text-4xl font-black sm:text-5xl">
            Built with passion for{" "}
            <span className="gradient-text">
              campus communities
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl leading-7 text-blue-100/65">
            CampusConnect is a full-stack platform designed to make
            communication between students, teachers and administrators
            simpler and more organized.
          </p>
        </div>

        <div className="glass-card mt-12 grid gap-10 rounded-3xl p-8 md:grid-cols-[260px_1fr] md:p-10">
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 blur-lg opacity-60" />

              <img
                src={developerPhoto}
                alt="CampusConnect developer"
                className="relative h-52 w-52 rounded-full border-4 border-white/10 object-cover shadow-2xl"
              />

              <div className="absolute -bottom-3 -right-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-[#171936] shadow-xl">
                <img
                  src={campusLogo}
                  alt="CampusConnect logo"
                  className="h-12 w-12 object-contain"
                />
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-lg font-bold text-white">
                Mansi Thakur 
              </p>

              <p className="mt-1 text-sm text-blue-100/60">
                Full-stack Developer
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-purple-300">
              About the developer
            </p>

            <h2 className="mt-3 text-3xl font-bold text-white">
              Creating a better campus experience
            </h2>

            <p className="mt-5 leading-8 text-blue-100/65">
              I created CampusConnect to provide students, teachers and
              administrators with a secure and organized communication
              platform. The application combines modern frontend design,
              secure authentication, department-based communities and
              real-time messaging.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              {technologies.map((technology) => (
                <span
                  key={technology}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-blue-100 transition hover:border-purple-400/40 hover:bg-white/10"
                >
                  {technology}
                </span>
              ))}
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-2xl font-bold text-white">
                  Full Stack
                </p>

                <p className="mt-1 text-xs text-blue-100/55">
                  Frontend and backend
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-2xl font-bold text-white">
                  Real Time
                </p>

                <p className="mt-1 text-xs text-blue-100/55">
                  Socket.IO messaging
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-2xl font-bold text-white">
                  Secure
                </p>

                <p className="mt-1 text-xs text-blue-100/55">
                  Role-based access
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DeveloperPage;