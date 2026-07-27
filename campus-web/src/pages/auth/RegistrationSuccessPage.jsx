import { Link, Navigate, useLocation } from "react-router-dom";

import BackHomeButton from "../../components/common/BackHomeButton.jsx";

import campusLogo from "../../assets/campus-logo.png";

const RegistrationSuccessPage = () => {
  const location = useLocation();

  const email = location.state?.email;

  const role = location.state?.role;

  if (!email || !role) {
    return <Navigate to="/register" replace />;
  }

  const isTeacher = role === "teacher";

  return (
    <main className="campus-gradient campus-grid relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <BackHomeButton className="absolute left-6 top-6" />
      <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />

      <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-purple-500/20 blur-3xl" />

      <section className="glass-card relative w-full max-w-md rounded-3xl p-8 text-center sm:p-10">
        <div className="pt-6">
          <img
            src={campusLogo}
            alt="CampusConnect"
            className="mx-auto h-16 w-16 object-contain"
          />

          <div className="mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 text-2xl text-green-400">
            ✓
          </div>

          <h1 className="mt-5 text-2xl font-bold text-white">
            Account created
          </h1>

          <p className="mt-3 text-sm leading-6 text-blue-100/65">
            We sent an email verification link to:
          </p>

          <p className="mt-1 font-semibold text-white">{email}</p>

          {isTeacher ? (
            <div className="mt-5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-left">
              <p className="text-sm leading-6 text-yellow-100">
                After verifying your email, your teacher account must be
                approved by an administrator.
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-left">
              <p className="text-sm leading-6 text-green-100">
                Verify your email, then you can sign in to your student account.
              </p>
            </div>
          )}

          <Link
            to="/login"
            className="gradient-button mt-6 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 font-semibold text-white shadow-lg shadow-purple-950/30 transition hover:-translate-y-0.5"
          >
            Go to login
          </Link>
        </div>
      </section>
    </main>
  );
};

export default RegistrationSuccessPage;
