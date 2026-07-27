import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { z } from "zod";

import { registerUser } from "../../services/authService.js";

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

const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must contain at least 2 characters")
      .max(100, "Name cannot exceed 100 characters"),

    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .email("Enter a valid email address"),

    role: z.enum(["student", "teacher"], {
      message: "Select student or teacher",
    }),

    password: z
      .string()
      .min(8, "Password must contain at least 8 characters"),

    confirmPassword: z
      .string()
      .min(1, "Confirm your password"),

    acceptTerms: z
      .boolean()
      .refine(
        (value) => value === true,
        "You must accept the Terms of Use and Privacy Policy"
      ),
  })
  .refine(
    (data) =>
      data.password === data.confirmPassword,
    {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }
  );

const RegisterPage = () => {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm({
    resolver: zodResolver(registerSchema),

    defaultValues: {
      name: "",
      email: "",
      role: "student",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  const selectedRole = watch("role");

  const onSubmit = async (formData) => {
    try {
      const registrationData = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      };

      const response =
        await registerUser(registrationData);

      toast.success(
        response?.message ||
          "Account created successfully"
      );

      navigate("/registration-success", {
        replace: true,
        state: {
          email: formData.email,
          role: formData.role,
        },
      });
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Unable to create account"
        )
      );
    }
  };

  return (
    <main className="campus-gradient campus-grid relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <BackHomeButton className="absolute left-6 top-6 z-20" />

      <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />

      <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-purple-500/20 blur-3xl" />

      <section className="glass-card relative z-10 w-full max-w-lg rounded-3xl p-7 sm:p-9">
        <div className="mb-7 pt-8 text-center sm:pt-6">
          <img
            src={campusLogo}
            alt="CampusConnect"
            className="mx-auto mb-5 h-20 w-20 object-contain"
          />

          <h1 className="text-2xl font-bold text-white">
            Create your account
          </h1>

          <p className="mt-2 text-sm text-blue-100/65">
            Join CampusConnect as a student or teacher
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-5"
        >
          <div>
            <label
              htmlFor="name"
              className="mb-2 block text-xs font-bold uppercase tracking-wide text-blue-100/65"
            >
              Full Name
            </label>

            <input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Enter your full name"
              disabled={isSubmitting}
              {...register("name")}
              className={inputClassName(
                Boolean(errors.name)
              )}
            />

            {errors.name && (
              <p className="mt-2 text-sm text-red-400">
                {errors.name.message}
              </p>
            )}
          </div>

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
              className={inputClassName(
                Boolean(errors.email)
              )}
            />

            {errors.email && (
              <p className="mt-2 text-sm text-red-400">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-100/65">
              Account Type
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label
                className={`cursor-pointer rounded-xl border p-4 transition ${
                  selectedRole === "student"
                    ? "border-purple-400/60 bg-purple-500/10"
                    : "border-white/10 bg-black/20 hover:border-purple-400/40"
                }`}
              >
                <input
                  type="radio"
                  value="student"
                  {...register("role")}
                  className="sr-only"
                />

                <span className="block font-semibold text-white">
                  Student
                </span>

                <span className="mt-1 block text-xs leading-5 text-blue-100/65">
                  Join your department and campus chats
                </span>
              </label>

              <label
                className={`cursor-pointer rounded-xl border p-4 transition ${
                  selectedRole === "teacher"
                    ? "border-purple-400/60 bg-purple-500/10"
                    : "border-white/10 bg-black/20 hover:border-purple-400/40"
                }`}
              >
                <input
                  type="radio"
                  value="teacher"
                  {...register("role")}
                  className="sr-only"
                />

                <span className="block font-semibold text-white">
                  Teacher
                </span>

                <span className="mt-1 block text-xs leading-5 text-blue-100/65">
                  Requires administrator approval
                </span>
              </label>
            </div>

            {errors.role && (
              <p className="mt-2 text-sm text-red-400">
                {errors.role.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-xs font-bold uppercase tracking-wide text-blue-100/65"
            >
              Password
            </label>

            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder="Create a password"
              disabled={isSubmitting}
              error={errors.password}
              {...register("password")}
            />

            {errors.password && (
              <p className="mt-2 text-sm text-red-400">
                {errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-xs font-bold uppercase tracking-wide text-blue-100/65"
            >
              Confirm Password
            </label>

            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              placeholder="Enter your password again"
              disabled={isSubmitting}
              error={errors.confirmPassword}
              {...register("confirmPassword")}
            />

            {errors.confirmPassword && (
              <p className="mt-2 text-sm text-red-400">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {selectedRole === "teacher" && (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
              <p className="text-sm leading-6 text-yellow-200">
                Teacher accounts must verify their email and be approved
                by an administrator before login.
              </p>
            </div>
          )}

          <div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/10 p-4">
              <input
                type="checkbox"
                disabled={isSubmitting}
                {...register("acceptTerms")}
                className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-purple-500 disabled:cursor-not-allowed"
              />

              <span className="text-sm leading-6 text-blue-100/65">
                I agree to the{" "}
                <Link
                  to="/terms"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-purple-300 transition hover:text-purple-200 hover:underline"
                >
                  Terms of Use
                </Link>{" "}
                and{" "}
                <Link
                  to="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-purple-300 transition hover:text-purple-200 hover:underline"
                >
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            {errors.acceptTerms && (
              <p className="mt-2 text-sm text-red-400">
                {errors.acceptTerms.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="gradient-button w-full rounded-xl px-4 py-3 font-semibold text-white shadow-lg shadow-purple-950/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Creating account..."
              : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-blue-100/65">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-blue-300 transition hover:text-blue-200 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
};

export default RegisterPage;