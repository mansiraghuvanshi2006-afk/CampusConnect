import { Link } from "react-router-dom";

import campusLogo from "../assets/campus-logo.png";

const NotFoundPage = () => {
  return (
    <main className="campus-gradient campus-grid relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12 text-white">
      <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />

      <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-purple-500/20 blur-3xl" />

      <section className="glass-card relative rounded-3xl p-10 text-center sm:p-14">
        <img
          src={campusLogo}
          alt="CampusConnect"
          className="mx-auto h-20 w-20 object-contain opacity-80"
        />

        <h1 className="mt-6 text-7xl font-black gradient-text">404</h1>

        <p className="mt-3 text-lg text-blue-100/65">Page not found</p>

        <p className="mx-auto mt-2 max-w-sm text-sm text-blue-100/45">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <Link
          to="/"
          className="gradient-button mt-8 inline-flex items-center justify-center rounded-xl px-8 py-3 font-semibold text-white shadow-lg shadow-purple-950/30 transition hover:-translate-y-0.5"
        >
          Return home
        </Link>
      </section>
    </main>
  );
};

export default NotFoundPage;
