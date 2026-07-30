import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { z } from "zod";

import useAuth from "../../hooks/useAuth.js";
import getErrorMessage from "../../utils/getErrorMessage.js";
import PasswordInput from "../../components/common/PasswordInput.jsx";
import BackHomeButton from "../../components/common/BackHomeButton.jsx";
import campusLogo from "../../assets/campus-logo.png";

const inputClassName = (hasError) =>
  `w-full rounded-xl border bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:ring-2 ${
    hasError
      ? "border-red-500 focus:border-red-500 focus:ring-red-500/30"
      : "border-white/10 focus:border-purple-400 focus:ring-purple-400/20"
  }`;

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),

  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must contain at least 8 characters"),
});

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { login, logout, getDashboardPath } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (formData) => {
    try {
      const user = await login(formData);

      // Admins must use the separate admin portal.
      if (user.role === "admin") {
        await logout();

        toast.error("Administrators must use the admin login portal");

        navigate("/admin/login", {
          replace: true,
        });

        return;
      }

      if (user.role !== "student" && user.role !== "teacher") {
        await logout();

        toast.error("Your account role is not supported");

        return;
      }

      const dashboardPath = getDashboardPath(user);

      // Admin-created accounts must set their own password first.
      if (user.mustChangePassword) {
        toast.success("Please set a new password to continue");

        navigate(dashboardPath, {
          replace: true,
        });

        return;
      }

      toast.success(`Welcome back, ${user.name}`);

      const requestedPath = location.state?.from;

      navigate(requestedPath || dashboardPath, {
        replace: true,
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to log in"));
    }
  };

  return (
    <main className="campus-gradient campus-grid relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <BackHomeButton className="absolute left-6 top-6" />
      <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />

      <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-purple-500/20 blur-3xl" />

      <section className="glass-card relative w-full max-w-md rounded-3xl p-7 sm:p-9">
        <div className="mb-7 pt-8 text-center sm:pt-6">
          <img
            src={campusLogo}
            alt="CampusConnect"
            className="mx-auto mb-5 h-20 w-20 object-contain"
          />

          <h1 className="text-2xl font-bold text-white">Welcome back</h1>

          <p className="mt-2 text-sm text-blue-100/65">
            Sign in as a student or teacher
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-5"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-xs font-bold uppercase tracking-wide text-blue-100/65"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@college.edu"
              disabled={isSubmitting}
              {...register("email")}
              className={inputClassName(Boolean(errors.email))}
            />

            {errors.email && (
              <p className="mt-2 text-sm text-red-400">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wide text-blue-100/65"
              >
                Password
              </label>

            </div>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              disabled={isSubmitting}
              error={errors.password}
              {...register("password")}
            />

            {/* <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              disabled={isSubmitting}
              {...register("password")}
              className={`w-full rounded-md border bg-[#1e1f22] px-3 py-3 text-sm text-white outline-none transition placeholder:text-[#6d6f78] focus:ring-2 ${
                errors.password
                  ? "border-red-500 focus:ring-red-500/30"
                  : "border-transparent focus:border-[#5865f2] focus:ring-[#5865f2]/30"
              }`}
            /> */}

            {errors.password && (
              <p className="mt-2 text-sm text-red-400">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="gradient-button w-full rounded-xl px-4 py-3 font-semibold text-white shadow-lg shadow-purple-950/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-sm text-blue-100/65">
          Need an account?{" "}
          <Link
            to="/register"
            className="font-medium text-blue-300 hover:underline"
          >
            Register
          </Link>
        </p>

        <div className="mt-6 border-t border-white/10 pt-5 text-center">
          <Link
            to="/admin/login"
            className="text-sm text-blue-100/65 hover:text-white"
          >
            Administrator login
          </Link>
        </div>
      </section>
    </main>
  );
};

export default LoginPage;
