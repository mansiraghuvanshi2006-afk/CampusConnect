import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { z } from "zod";

import useAuth from "../../hooks/useAuth.js";
import getErrorMessage from "../../utils/getErrorMessage.js";
import PasswordInput from "../../components/common/PasswordInput.jsx";
import { changeTemporaryPassword } from "../../services/authService.js";
import campusLogo from "../../assets/campus-logo.png";

/*
  Mirrors the backend password rules so users see problems
  before the request is sent.
*/
const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Your temporary password is required"),

    newPassword: z
      .string()
      .min(8, "Password must contain at least 8 characters")
      .max(128, "Password cannot exceed 128 characters")
      .regex(
        /[a-z]/,
        "Password must contain a lowercase letter"
      )
      .regex(
        /[A-Z]/,
        "Password must contain an uppercase letter"
      )
      .regex(/[0-9]/, "Password must contain a number"),

    confirmPassword: z
      .string()
      .min(1, "Password confirmation is required"),
  })
  .refine(
    (data) => data.newPassword === data.confirmPassword,
    {
      message: "New password and confirmation do not match",
      path: ["confirmPassword"],
    }
  )
  .refine(
    (data) => data.newPassword !== data.currentPassword,
    {
      message:
        "The new password must be different from your temporary password",
      path: ["newPassword"],
    }
  );

const ChangeTemporaryPasswordPage = () => {
  const navigate = useNavigate();

  const { user, updateUser, logout, getDashboardPath } =
    useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (formData) => {
    try {
      const updatedUser = await changeTemporaryPassword(
        formData
      );

      updateUser(
        updatedUser || { mustChangePassword: false }
      );

      toast.success("Password updated successfully");

      navigate(
        getDashboardPath({
          ...user,
          ...(updatedUser || {}),
          mustChangePassword: false,
        }),
        { replace: true }
      );
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Unable to change your password"
        )
      );
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <main className="campus-gradient campus-grid relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />

      <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-purple-500/20 blur-3xl" />

      <section className="glass-card relative w-full max-w-md rounded-3xl p-7 sm:p-9">
        <div className="mb-7 text-center">
          <img
            src={campusLogo}
            alt="CampusConnect"
            className="mx-auto mb-5 h-16 w-16 object-contain"
          />

          <h1 className="text-2xl font-bold text-white">
            Set your password
          </h1>

          <p className="mt-2 text-sm text-blue-100/65">
            Your account was created by an administrator.
            Choose a new password to continue.
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-5"
        >
          <div>
            <label
              htmlFor="currentPassword"
              className="mb-2 block text-xs font-bold uppercase tracking-wide text-blue-100/65"
            >
              Temporary password
            </label>

            <PasswordInput
              id="currentPassword"
              autoComplete="current-password"
              placeholder="Enter the password you were given"
              disabled={isSubmitting}
              error={errors.currentPassword}
              {...register("currentPassword")}
            />

            {errors.currentPassword && (
              <p className="mt-2 text-sm text-red-400">
                {errors.currentPassword.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="newPassword"
              className="mb-2 block text-xs font-bold uppercase tracking-wide text-blue-100/65"
            >
              New password
            </label>

            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              placeholder="Create a strong password"
              disabled={isSubmitting}
              error={errors.newPassword}
              {...register("newPassword")}
            />

            {errors.newPassword ? (
              <p className="mt-2 text-sm text-red-400">
                {errors.newPassword.message}
              </p>
            ) : (
              <p className="mt-2 text-xs text-blue-100/50">
                At least 8 characters with upper and lower
                case letters and a number.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-xs font-bold uppercase tracking-wide text-blue-100/65"
            >
              Confirm new password
            </label>

            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              placeholder="Repeat your new password"
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="gradient-button w-full rounded-xl px-4 py-3 font-semibold text-white shadow-lg shadow-purple-950/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Saving password..."
              : "Save password and continue"}
          </button>
        </form>

        <div className="mt-6 border-t border-white/10 pt-5 text-center">
          <button
            type="button"
            onClick={handleSignOut}
            className="text-sm text-blue-100/65 transition hover:text-white"
          >
            Sign out instead
          </button>
        </div>
      </section>
    </main>
  );
};

export default ChangeTemporaryPasswordPage;
