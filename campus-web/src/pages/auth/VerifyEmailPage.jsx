import { useEffect, useState } from "react";
import {
  Link,
  useSearchParams,
} from "react-router-dom";

import {
  verifyEmail,
} from "../../services/authService.js";

import getErrorMessage from "../../utils/getErrorMessage.js";
import campusLogo from "../../assets/campus-logo.png";

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();

  const [status, setStatus] =
    useState("verifying");

  const [message, setMessage] =
    useState("Verifying your email address...");

  const [userRole, setUserRole] =
    useState(null);

  const token = searchParams.get("token");

  useEffect(() => {
    let isMounted = true;

    const verify = async () => {
      if (!token) {
        setStatus("error");
        setMessage(
          "The verification token is missing."
        );
        return;
      }

      try {
        const response =
          await verifyEmail(token);

        if (!isMounted) {
          return;
        }

        setUserRole(
          response?.data?.user?.role || null
        );

        setStatus("success");

        setMessage(
          response?.message ||
            "Your email was verified successfully."
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setStatus("error");

        setMessage(
          getErrorMessage(
            error,
            "Unable to verify your email address."
          )
        );
      }
    };

    verify();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const isTeacher =
    userRole === "teacher";

  return (
    <main className="campus-gradient campus-grid relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />

      <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-purple-500/20 blur-3xl" />

      <section className="glass-card relative z-10 w-full max-w-md rounded-3xl p-8 text-center sm:p-10">
        <img
          src={campusLogo}
          alt="CampusConnect"
          className="mx-auto mb-6 h-20 w-20 object-contain"
        />

        {status === "verifying" && (
          <>
            <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-purple-400" />

            <h1 className="text-2xl font-bold text-white">
              Verifying email
            </h1>

            <p className="mt-3 text-sm leading-6 text-blue-100/65">
              {message}
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 text-2xl text-green-300">
              ✓
            </div>

            <h1 className="text-2xl font-bold text-white">
              Email verified
            </h1>

            <p className="mt-3 text-sm leading-6 text-blue-100/70">
              {message}
            </p>

            {isTeacher && (
              <div className="mt-5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
                <p className="text-sm leading-6 text-yellow-200">
                  Your teacher account must now be
                  approved by an administrator before
                  you can log in.
                </p>
              </div>
            )}

            {!isTeacher && (
              <Link
                to="/login"
                className="gradient-button mt-7 inline-flex w-full justify-center rounded-xl px-4 py-3 font-semibold text-white"
              >
                Continue to login
              </Link>
            )}

            {isTeacher && (
              <Link
                to="/"
                className="mt-7 inline-flex w-full justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                Return to home
              </Link>
            )}
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-2xl text-red-300">
              !
            </div>

            <h1 className="text-2xl font-bold text-white">
              Verification failed
            </h1>

            <p className="mt-3 text-sm leading-6 text-blue-100/70">
              {message}
            </p>

            <Link
              to="/login"
              className="mt-7 inline-flex w-full justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              Go to login
            </Link>
          </>
        )}
      </section>
    </main>
  );
};

export default VerifyEmailPage;