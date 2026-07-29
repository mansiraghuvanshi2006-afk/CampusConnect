import { useState } from "react";

const initialFormData = {
  name: "",
  code: "",
  description: "",
  durationInYears: "4",
  isActive: true,
};

const DepartmentForm = ({
  department = null,
  isSubmitting = false,
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState(() =>
    department
      ? {
          name: department.name || "",
          code: department.code || "",
          description: department.description || "",
          durationInYears: String(department.durationInYears || 4),
          isActive: department.isActive ?? true,
        }
      : initialFormData
  );

  const [errors, setErrors] = useState({});

  const isEditing = Boolean(department?._id || department?.id);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    const nextValue = type === "checkbox" ? checked : value;

    setFormData((current) => ({
      ...current,
      [name]: nextValue,
    }));

    if (errors[name]) {
      setErrors((current) => ({
        ...current,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const nextErrors = {};

    const trimmedName = formData.name.trim();

    const trimmedCode = formData.code.trim();

    const trimmedDescription = formData.description.trim();

    const durationInYears = Number(formData.durationInYears);

    if (!trimmedName) {
      nextErrors.name = "Department name is required";
    } else if (trimmedName.length < 2) {
      nextErrors.name = "Department name must contain at least 2 characters";
    } else if (trimmedName.length > 100) {
      nextErrors.name = "Department name cannot exceed 100 characters";
    }

    if (!trimmedCode) {
      nextErrors.code = "Department code is required";
    } else if (trimmedCode.length < 2) {
      nextErrors.code = "Department code must contain at least 2 characters";
    } else if (trimmedCode.length > 20) {
      nextErrors.code = "Department code cannot exceed 20 characters";
    } else if (!/^[A-Za-z0-9_-]+$/.test(trimmedCode)) {
      nextErrors.code =
        "Code can only contain letters, numbers, hyphens and underscores";
    }

    if (trimmedDescription.length > 500) {
      nextErrors.description = "Description cannot exceed 500 characters";
    }

    if (!Number.isInteger(durationInYears)) {
      nextErrors.durationInYears = "Duration must be a whole number";
    } else if (durationInYears < 1) {
      nextErrors.durationInYears = "Duration must be at least 1 year";
    } else if (durationInYears > 10) {
      nextErrors.durationInYears = "Duration cannot exceed 10 years";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    const departmentData = {
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      description: formData.description.trim(),
      durationInYears: Number(formData.durationInYears),
      isActive: formData.isActive,
    };

    await onSubmit(departmentData);
  };

  const inputClassName = (fieldName) =>
    `w-full rounded-xl border bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:ring-2 ${
      errors[fieldName]
        ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
        : "border-white/10 focus:border-purple-400 focus:ring-purple-400/20"
    }`;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="department-name"
          className="mb-2 block text-sm font-semibold text-white"
        >
          Department name
        </label>

        <input
          id="department-name"
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          disabled={isSubmitting}
          maxLength={100}
          placeholder="Computer Science Engineering"
          className={inputClassName("name")}
        />

        {errors.name && (
          <p className="mt-2 text-sm text-red-300">{errors.name}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="department-code"
          className="mb-2 block text-sm font-semibold text-white"
        >
          Department code
        </label>

        <input
          id="department-code"
          type="text"
          name="code"
          value={formData.code}
          onChange={handleChange}
          disabled={isSubmitting}
          maxLength={20}
          placeholder="CSE"
          className={inputClassName("code")}
        />

        {errors.code ? (
          <p className="mt-2 text-sm text-red-300">{errors.code}</p>
        ) : (
          <p className="mt-2 text-xs text-[#949ba4]">
            Letters, numbers, hyphens and underscores are allowed.
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="department-duration"
          className="mb-2 block text-sm font-semibold text-white"
        >
          Department duration
        </label>

        <select
          id="department-duration"
          name="durationInYears"
          value={formData.durationInYears}
          onChange={handleChange}
          disabled={isSubmitting}
          className={inputClassName("durationInYears")}
        >
          {Array.from(
            {
              length: 10,
            },
            (_, index) => {
              const year = index + 1;

              return (
                <option
                  key={year}
                  value={year}
                  className="bg-[#1e1f22] text-white"
                >
                  {year} {year === 1 ? "Year" : "Years"}
                </option>
              );
            },
          )}
        </select>

        {errors.durationInYears ? (
          <p className="mt-2 text-sm text-red-300">{errors.durationInYears}</p>
        ) : (
          <p className="mt-2 text-xs text-[#949ba4]">
            Academic years will be created automatically based on this duration.
          </p>
        )}

        {isEditing && (
          <p className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            Increasing the duration creates missing years. Reducing it may
            require removing higher years first.
          </p>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-4">
          <label
            htmlFor="department-description"
            className="block text-sm font-semibold text-white"
          >
            Description
          </label>

          <span className="text-xs text-[#949ba4]">
            {formData.description.length}
            /500
          </span>
        </div>

        <textarea
          id="department-description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          disabled={isSubmitting}
          rows={5}
          maxLength={500}
          placeholder="Enter a short department description"
          className={`${inputClassName("description")} resize-none`}
        />

        {errors.description && (
          <p className="mt-2 text-sm text-red-300">{errors.description}</p>
        )}
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-4">
        <div>
          <p className="text-sm font-semibold text-white">Active department</p>

          <p className="mt-1 text-xs text-[#b5bac1]">
            Inactive departments can remain saved without being available for
            selection.
          </p>
        </div>

        <input
          type="checkbox"
          name="isActive"
          checked={formData.isActive}
          onChange={handleChange}
          disabled={isSubmitting}
          className="h-5 w-5 cursor-pointer accent-purple-600"
        />
      </label>

      <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting
            ? isEditing
              ? "Updating..."
              : "Creating..."
            : isEditing
              ? "Update Department"
              : "Create Department"}
        </button>
      </div>
    </form>
  );
};

export default DepartmentForm;
