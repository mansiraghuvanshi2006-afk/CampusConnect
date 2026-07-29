import { useState } from "react";

const initialFormData = {
  yearNumber: "",
  name: "",
  sortOrder: "",
  isActive: true,
};

const AcademicYearForm = ({
  academicYear = null,
  isSubmitting = false,
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState(() =>
    academicYear
      ? {
          yearNumber: String(academicYear.yearNumber || ""),
          name: academicYear.name || "",
          sortOrder: String(
            academicYear.sortOrder ?? academicYear.yearNumber ?? ""
          ),
          isActive: academicYear.isActive ?? true,
        }
      : initialFormData
  );
  const [errors, setErrors] = useState({});

  const handleChange = (event) => {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    const nextValue =
      type === "checkbox" ? checked : value;

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

    const trimmedName =
      formData.name.trim();

    const sortOrder = Number(
      formData.sortOrder
    );

    if (!trimmedName) {
      nextErrors.name =
        "Academic year name is required";
    } else if (trimmedName.length < 2) {
      nextErrors.name =
        "Academic year name must contain at least 2 characters";
    } else if (trimmedName.length > 100) {
      nextErrors.name =
        "Academic year name cannot exceed 100 characters";
    }

    if (!Number.isInteger(sortOrder)) {
      nextErrors.sortOrder =
        "Sort order must be a whole number";
    } else if (sortOrder < 1) {
      nextErrors.sortOrder =
        "Sort order must be at least 1";
    } else if (sortOrder > 100) {
      nextErrors.sortOrder =
        "Sort order cannot exceed 100";
    }

    setErrors(nextErrors);

    return (
      Object.keys(nextErrors).length === 0
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    const academicYearData = {
      name: formData.name.trim(),
      sortOrder: Number(
        formData.sortOrder
      ),
      isActive: formData.isActive,
    };

    await onSubmit(academicYearData);
  };

  const inputClassName = (fieldName) =>
    `w-full rounded-xl border bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:ring-2 ${
      errors[fieldName]
        ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
        : "border-white/10 focus:border-purple-400 focus:ring-purple-400/20"
    }`;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <div>
        <label
          htmlFor="academic-year-number"
          className="mb-2 block text-sm font-semibold text-white"
        >
          Year number
        </label>

        <input
          id="academic-year-number"
          type="number"
          value={formData.yearNumber}
          disabled
          className={`${inputClassName(
            "yearNumber"
          )} cursor-not-allowed opacity-60`}
        />

        <p className="mt-2 text-xs text-[#949ba4]">
          Year numbers are generated
          automatically from the department
          duration and cannot be changed here.
        </p>
      </div>

      <div>
        <label
          htmlFor="academic-year-name"
          className="mb-2 block text-sm font-semibold text-white"
        >
          Academic year name
        </label>

        <input
          id="academic-year-name"
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          disabled={isSubmitting}
          maxLength={100}
          placeholder="1st Year"
          className={inputClassName("name")}
        />

        {errors.name && (
          <p className="mt-2 text-sm text-red-300">
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="academic-year-sort-order"
          className="mb-2 block text-sm font-semibold text-white"
        >
          Sort order
        </label>

        <input
          id="academic-year-sort-order"
          type="number"
          name="sortOrder"
          value={formData.sortOrder}
          onChange={handleChange}
          disabled={isSubmitting}
          min={1}
          max={100}
          placeholder="1"
          className={inputClassName(
            "sortOrder"
          )}
        />

        {errors.sortOrder ? (
          <p className="mt-2 text-sm text-red-300">
            {errors.sortOrder}
          </p>
        ) : (
          <p className="mt-2 text-xs text-[#949ba4]">
            Lower numbers appear first in
            the academic-year list.
          </p>
        )}
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-4">
        <div>
          <p className="text-sm font-semibold text-white">
            Active academic year
          </p>

          <p className="mt-1 text-xs text-[#b5bac1]">
            Inactive academic years remain
            saved but are unavailable for
            student and teacher selection.
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
            ? "Updating..."
            : "Update Academic Year"}
        </button>
      </div>
    </form>
  );
};

export default AcademicYearForm;
