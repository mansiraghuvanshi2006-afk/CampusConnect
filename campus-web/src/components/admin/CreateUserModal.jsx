import {
  useEffect,
  useMemo,
  useState,
} from "react";

import toast from "react-hot-toast";

import PasswordInput from "../common/PasswordInput.jsx";
import { createAdminUser } from "../../services/adminService.js";
import { getAcademicYears } from "../../services/academicYearService.js";
import getErrorMessage from "../../utils/getErrorMessage.js";

const roleOptions = [
  {
    value: "student",
    label: "Student",
    description:
      "Needs a department and one academic year.",
  },
  {
    value: "teacher",
    label: "Teacher",
    description:
      "Needs a department and at least one assigned year.",
  },
  {
    value: "admin",
    label: "Admin",
    description:
      "Full platform access. No department required.",
  },
];

const initialForm = {
  role: "student",
  name: "",
  email: "",
  temporaryPassword: "",
  department: "",
  year: "",
  teachingYears: [],
  isActive: true,
};

const fieldClassName = (hasError) =>
  `w-full rounded-xl border bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:ring-2 ${
    hasError
      ? "border-red-500 focus:border-red-500 focus:ring-red-500/30"
      : "border-white/10 focus:border-purple-400 focus:ring-purple-400/20"
  }`;

/**
 * Client-side mirror of the backend validation rules so the
 * admin sees problems before the request is sent.
 */
const validateForm = (form) => {
  const errors = {};

  if (form.name.trim().length < 2) {
    errors.name =
      "Full name must contain at least 2 characters";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = "Enter a valid email address";
  }

  const password = form.temporaryPassword;

  if (password.length < 8) {
    errors.temporaryPassword =
      "Temporary password must contain at least 8 characters";
  } else if (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    errors.temporaryPassword =
      "Use upper and lower case letters and a number";
  }

  if (form.role !== "admin" && !form.department) {
    errors.department = "Select a department";
  }

  if (form.role === "student" && !form.year) {
    errors.year = "Select an academic year";
  }

  if (
    form.role === "teacher" &&
    form.teachingYears.length === 0
  ) {
    errors.teachingYears =
      "Select at least one assigned academic year";
  }

  return errors;
};

const CreateUserModal = ({
  departments = [],
  onClose,
  onCreated,
}) => {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [availableYears, setAvailableYears] = useState([]);
  const [isLoadingYears, setIsLoadingYears] =
    useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeDepartments = useMemo(
    () =>
      departments.filter(
        (department) => department.isActive !== false
      ),
    [departments]
  );

  useEffect(() => {
    let cancelled = false;

    const loadYears = async () => {
      if (!form.department) {
        setAvailableYears([]);

        return;
      }

      try {
        setIsLoadingYears(true);

        const response = await getAcademicYears(
          form.department
        );

        if (cancelled) {
          return;
        }

        setAvailableYears(
          Array.isArray(response?.data?.academicYears)
            ? response.data.academicYears.filter(
                (year) => year.isActive !== false
              )
            : []
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        setAvailableYears([]);

        toast.error(
          getErrorMessage(
            error,
            "Unable to load academic years"
          ),
          { id: "create-user-years" }
        );
      } finally {
        if (!cancelled) {
          setIsLoadingYears(false);
        }
      }
    };

    void loadYears();

    return () => {
      cancelled = true;
    };
  }, [form.department]);

  const updateField = (name, value) => {
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setErrors((previous) => ({
      ...previous,
      [name]: undefined,
    }));
  };

  const handleRoleChange = (role) => {
    setForm((previous) => ({
      ...previous,
      role,
      department:
        role === "admin" ? "" : previous.department,
      year: role === "student" ? previous.year : "",
      teachingYears:
        role === "teacher" ? previous.teachingYears : [],
    }));

    setErrors({});
  };

  const toggleTeachingYear = (yearNumber) => {
    setForm((previous) => {
      const selected = previous.teachingYears.includes(
        yearNumber
      )
        ? previous.teachingYears.filter(
            (year) => year !== yearNumber
          )
        : [...previous.teachingYears, yearNumber];

      return {
        ...previous,
        teachingYears: selected.sort(
          (first, second) => first - second
        ),
      };
    });

    setErrors((previous) => ({
      ...previous,
      teachingYears: undefined,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationErrors = validateForm(form);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const payload = {
      role: form.role,
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      temporaryPassword: form.temporaryPassword,
      isActive: form.isActive,
    };

    if (form.role === "student") {
      payload.department = form.department;
      payload.year = Number(form.year);
    }

    if (form.role === "teacher") {
      payload.department = form.department;
      payload.teachingYears = form.teachingYears;
    }

    try {
      setIsSubmitting(true);

      const response = await createAdminUser(payload);

      toast.success(
        response?.message || "Account created successfully"
      );

      onCreated?.(response?.data?.user);
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Unable to create the account"
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }

    onClose?.();
  };

  const selectedRole = roleOptions.find(
    (option) => option.value === form.role
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8">
      <section className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#2b2d31] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">
              Create User
            </h2>

            <p className="mt-2 text-sm text-[#b5bac1]">
              The account is ready immediately. The user
              signs in with the temporary password and must
              replace it right away.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-6 space-y-5"
        >
          <div>
            <span className="mb-2 block text-sm font-semibold text-white">
              Account type
            </span>

            <div className="grid gap-2 sm:grid-cols-3">
              {roleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    handleRoleChange(option.value)
                  }
                  disabled={isSubmitting}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:opacity-50 ${
                    form.role === option.value
                      ? "border-purple-400 bg-purple-500/15 text-white"
                      : "border-white/10 bg-black/20 text-[#b5bac1] hover:bg-white/5"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <p className="mt-2 text-xs text-[#949ba4]">
              {selectedRole?.description}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="create-user-name"
                className="mb-2 block text-sm font-semibold text-white"
              >
                Full name
              </label>

              <input
                id="create-user-name"
                type="text"
                value={form.name}
                onChange={(event) =>
                  updateField("name", event.target.value)
                }
                disabled={isSubmitting}
                placeholder="Jane Doe"
                className={fieldClassName(
                  Boolean(errors.name)
                )}
              />

              {errors.name && (
                <p className="mt-2 text-sm text-red-400">
                  {errors.name}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="create-user-email"
                className="mb-2 block text-sm font-semibold text-white"
              >
                Email
              </label>

              <input
                id="create-user-email"
                type="email"
                value={form.email}
                onChange={(event) =>
                  updateField("email", event.target.value)
                }
                disabled={isSubmitting}
                placeholder="name@college.edu"
                className={fieldClassName(
                  Boolean(errors.email)
                )}
              />

              {errors.email && (
                <p className="mt-2 text-sm text-red-400">
                  {errors.email}
                </p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="create-user-password"
              className="mb-2 block text-sm font-semibold text-white"
            >
              Temporary password
            </label>

            <PasswordInput
              id="create-user-password"
              autoComplete="new-password"
              value={form.temporaryPassword}
              onChange={(event) =>
                updateField(
                  "temporaryPassword",
                  event.target.value
                )
              }
              disabled={isSubmitting}
              error={errors.temporaryPassword}
              placeholder="Share this with the user securely"
            />

            {errors.temporaryPassword ? (
              <p className="mt-2 text-sm text-red-400">
                {errors.temporaryPassword}
              </p>
            ) : (
              <p className="mt-2 text-xs text-[#949ba4]">
                At least 8 characters with upper and lower
                case letters and a number.
              </p>
            )}
          </div>

          {form.role !== "admin" && (
            <div>
              <label
                htmlFor="create-user-department"
                className="mb-2 block text-sm font-semibold text-white"
              >
                Department
              </label>

              <select
                id="create-user-department"
                value={form.department}
                onChange={(event) =>
                  updateField(
                    "department",
                    event.target.value
                  )
                }
                disabled={isSubmitting}
                className={fieldClassName(
                  Boolean(errors.department)
                )}
              >
                <option
                  value=""
                  className="bg-[#1e1f22]"
                >
                  Select a department
                </option>

                {activeDepartments.map((department) => (
                  <option
                    key={department._id || department.id}
                    value={department._id || department.id}
                    className="bg-[#1e1f22]"
                  >
                    {department.name}
                  </option>
                ))}
              </select>

              {errors.department && (
                <p className="mt-2 text-sm text-red-400">
                  {errors.department}
                </p>
              )}
            </div>
          )}

          {form.role === "student" && (
            <div>
              <label
                htmlFor="create-user-year"
                className="mb-2 block text-sm font-semibold text-white"
              >
                Academic year
              </label>

              <select
                id="create-user-year"
                value={form.year}
                onChange={(event) =>
                  updateField("year", event.target.value)
                }
                disabled={
                  isSubmitting ||
                  !form.department ||
                  isLoadingYears
                }
                className={fieldClassName(
                  Boolean(errors.year)
                )}
              >
                <option
                  value=""
                  className="bg-[#1e1f22]"
                >
                  {form.department
                    ? isLoadingYears
                      ? "Loading years..."
                      : "Select an academic year"
                    : "Select a department first"}
                </option>

                {availableYears.map((academicYear) => (
                  <option
                    key={
                      academicYear._id || academicYear.id
                    }
                    value={academicYear.yearNumber}
                    className="bg-[#1e1f22]"
                  >
                    {academicYear.name}
                  </option>
                ))}
              </select>

              {errors.year && (
                <p className="mt-2 text-sm text-red-400">
                  {errors.year}
                </p>
              )}

              {form.department &&
                !isLoadingYears &&
                availableYears.length === 0 && (
                  <p className="mt-2 text-xs text-yellow-200">
                    This department has no active academic
                    years yet.
                  </p>
                )}
            </div>
          )}

          {form.role === "teacher" && (
            <div>
              <span className="mb-2 block text-sm font-semibold text-white">
                Assigned academic years
              </span>

              {!form.department && (
                <p className="text-xs text-[#949ba4]">
                  Select a department first.
                </p>
              )}

              {form.department && isLoadingYears && (
                <p className="text-xs text-[#949ba4]">
                  Loading years...
                </p>
              )}

              {form.department &&
                !isLoadingYears &&
                availableYears.length === 0 && (
                  <p className="text-xs text-yellow-200">
                    This department has no active academic
                    years yet.
                  </p>
                )}

              {availableYears.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableYears.map((academicYear) => {
                    const yearNumber = Number(
                      academicYear.yearNumber
                    );

                    return (
                      <label
                        key={
                          academicYear._id ||
                          academicYear.id
                        }
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white"
                      >
                        <input
                          type="checkbox"
                          checked={form.teachingYears.includes(
                            yearNumber
                          )}
                          onChange={() =>
                            toggleTeachingYear(yearNumber)
                          }
                          disabled={isSubmitting}
                        />

                        <span>{academicYear.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {errors.teachingYears && (
                <p className="mt-2 text-sm text-red-400">
                  {errors.teachingYears}
                </p>
              )}
            </div>
          )}

          <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                updateField(
                  "isActive",
                  event.target.checked
                )
              }
              disabled={isSubmitting}
            />

            <span>
              Account is active and can sign in immediately
            </span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? "Creating..."
                : "Create account"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default CreateUserModal;
