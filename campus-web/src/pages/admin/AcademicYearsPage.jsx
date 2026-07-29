import {
    useEffect,
    useMemo,
    useState,
  } from "react";
  
  import toast from "react-hot-toast";
  
  import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
  import AcademicYearForm from "../../components/admin/AcademicYearForm.jsx";
  
  import {
    getDepartments,
  } from "../../services/departmentService.js";
  
  import {
    getAcademicYears,
    toggleAcademicYearStatus,
    updateAcademicYear,
  } from "../../services/academicYearService.js";
  
  import getErrorMessage from "../../utils/getErrorMessage.js";
  
  const AcademicYearsPage = () => {
    const [departments, setDepartments] =
      useState([]);
  
    const [academicYears, setAcademicYears] =
      useState([]);
  
    const [
      selectedDepartmentId,
      setSelectedDepartmentId,
    ] = useState("");
  
    const [
      selectedAcademicYear,
      setSelectedAcademicYear,
    ] = useState(null);
  
    const [
      isLoadingDepartments,
      setIsLoadingDepartments,
    ] = useState(true);
  
    const [
      isLoadingYears,
      setIsLoadingYears,
    ] = useState(false);
  
    const [
      isSubmitting,
      setIsSubmitting,
    ] = useState(false);
  
    const [
      togglingYearId,
      setTogglingYearId,
    ] = useState("");
  
    const [isFormOpen, setIsFormOpen] =
      useState(false);
  
    const selectedDepartment = useMemo(
      () =>
        departments.find(
          (department) =>
            (department._id ||
              department.id) ===
            selectedDepartmentId
        ) || null,
      [
        departments,
        selectedDepartmentId,
      ]
    );
  
    const activeAcademicYearsCount =
      useMemo(
        () =>
          academicYears.filter(
            (academicYear) =>
              academicYear.isActive
          ).length,
        [academicYears]
      );
  
    const loadDepartments = async () => {
      try {
        setIsLoadingDepartments(true);
  
        const response =
          await getDepartments();
  
        const departmentList =
          response?.data?.departments ||
          response?.departments ||
          response?.data ||
          [];
  
        const normalizedDepartments =
          Array.isArray(departmentList)
            ? departmentList
            : [];
  
        setDepartments(
          normalizedDepartments
        );
  
        if (
          normalizedDepartments.length > 0
        ) {
          const firstDepartmentId =
            normalizedDepartments[0]._id ||
            normalizedDepartments[0].id;
  
          setSelectedDepartmentId(
            (current) =>
              current ||
              firstDepartmentId
          );
        }
      } catch (error) {
        toast.error(
          getErrorMessage(
            error,
            "Unable to load departments"
          )
        );
      } finally {
        setIsLoadingDepartments(false);
      }
    };
  
    const loadAcademicYears = async (
      departmentId
    ) => {
      if (!departmentId) {
        setAcademicYears([]);
        return;
      }
  
      try {
        setIsLoadingYears(true);
  
        const response =
          await getAcademicYears(
            departmentId
          );
  
        const academicYearList =
          response?.data?.academicYears ||
          response?.academicYears ||
          response?.data ||
          [];
  
        const normalizedAcademicYears =
          Array.isArray(academicYearList)
            ? academicYearList
            : [];
  
        const sortedAcademicYears = [
          ...normalizedAcademicYears,
        ].sort(
          (firstYear, secondYear) =>
            (firstYear.sortOrder ??
              firstYear.yearNumber ??
              0) -
            (secondYear.sortOrder ??
              secondYear.yearNumber ??
              0)
        );
  
        setAcademicYears(
          sortedAcademicYears
        );
      } catch (error) {
        setAcademicYears([]);
  
        toast.error(
          getErrorMessage(
            error,
            "Unable to load academic years"
          )
        );
      } finally {
        setIsLoadingYears(false);
      }
    };
  
    useEffect(() => {
      const timeoutId = window.setTimeout(
        loadDepartments,
        0
      );

      return () => window.clearTimeout(timeoutId);
    }, []);
  
    useEffect(() => {
      if (selectedDepartmentId) {
        const timeoutId = window.setTimeout(
          () => loadAcademicYears(selectedDepartmentId),
          0
        );

        return () => window.clearTimeout(timeoutId);
      }

      return undefined;
    }, [selectedDepartmentId]);
  
    const handleDepartmentChange = (
      event
    ) => {
      setSelectedDepartmentId(
        event.target.value
      );
  
      setSelectedAcademicYear(null);
      setIsFormOpen(false);
    };
  
    const handleOpenEditForm = (
      academicYear
    ) => {
      setSelectedAcademicYear(
        academicYear
      );
  
      setIsFormOpen(true);
    };
  
    const handleCloseForm = () => {
      if (isSubmitting) {
        return;
      }
  
      setSelectedAcademicYear(null);
      setIsFormOpen(false);
    };
  
    const handleSubmit = async (
      academicYearData
    ) => {
      const academicYearId =
        selectedAcademicYear?._id ||
        selectedAcademicYear?.id;
  
      if (!academicYearId) {
        toast.error(
          "Please select an academic year to edit"
        );
  
        return;
      }
  
      try {
        setIsSubmitting(true);
  
        await updateAcademicYear(
          academicYearId,
          academicYearData
        );
  
        toast.success(
          "Academic year updated successfully"
        );
  
        await loadAcademicYears(
          selectedDepartmentId
        );
  
        setSelectedAcademicYear(null);
        setIsFormOpen(false);
      } catch (error) {
        toast.error(
          getErrorMessage(
            error,
            "Unable to update academic year"
          )
        );
      } finally {
        setIsSubmitting(false);
      }
    };
  
    const handleToggleStatus = async (
      academicYear
    ) => {
      const academicYearId =
        academicYear._id ||
        academicYear.id;
  
      if (!academicYearId) {
        toast.error(
          "Academic year ID is unavailable"
        );
  
        return;
      }
  
      try {
        setTogglingYearId(
          academicYearId
        );
  
        await toggleAcademicYearStatus(
          academicYearId,
          !academicYear.isActive
        );
  
        setAcademicYears(
          (currentYears) =>
            currentYears.map(
              (currentYear) => {
                const currentYearId =
                  currentYear._id ||
                  currentYear.id;
  
                if (
                  currentYearId !==
                  academicYearId
                ) {
                  return currentYear;
                }
  
                return {
                  ...currentYear,
                  isActive:
                    !currentYear.isActive,
                };
              }
            )
        );
  
        toast.success(
          academicYear.isActive
            ? "Academic year deactivated"
            : "Academic year activated"
        );
      } catch (error) {
        toast.error(
          getErrorMessage(
            error,
            "Unable to update academic year status"
          )
        );
      } finally {
        setTogglingYearId("");
      }
    };
  
    return (
      <DashboardLayout
        title="Academic Years"
        description="View and manage automatically generated academic years for each department."
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-[#2b2d31] p-5 shadow-xl">
              <label
                htmlFor="department"
                className="mb-2 block text-sm font-semibold text-white"
              >
                Select department
              </label>
  
              <select
                id="department"
                value={
                  selectedDepartmentId
                }
                onChange={
                  handleDepartmentChange
                }
                disabled={
                  isLoadingDepartments ||
                  departments.length === 0
                }
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {departments.length === 0 ? (
                  <option
                    value=""
                    className="bg-[#2b2d31]"
                  >
                    No departments available
                  </option>
                ) : (
                  departments.map(
                    (department) => {
                      const departmentId =
                        department._id ||
                        department.id;
  
                      return (
                        <option
                          key={
                            departmentId
                          }
                          value={
                            departmentId
                          }
                          className="bg-[#2b2d31]"
                        >
                          {department.name} (
                          {department.code})
                        </option>
                      );
                    }
                  )
                )}
              </select>
  
              <p className="mt-2 text-xs text-[#949ba4]">
                Academic years are created
                automatically from the
                department duration.
              </p>
            </section>
  
            {selectedDepartment && (
              <section className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-[#2b2d31] p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#949ba4]">
                    Department
                  </p>
  
                  <p className="mt-2 text-lg font-bold text-white">
                    {
                      selectedDepartment.code
                    }
                  </p>
  
                  <p className="mt-1 truncate text-sm text-[#b5bac1]">
                    {
                      selectedDepartment.name
                    }
                  </p>
                </div>
  
                <div className="rounded-2xl border border-white/10 bg-[#2b2d31] p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#949ba4]">
                    Total years
                  </p>
  
                  <p className="mt-2 text-2xl font-bold text-white">
                    {academicYears.length}
                  </p>
                </div>
  
                <div className="rounded-2xl border border-white/10 bg-[#2b2d31] p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#949ba4]">
                    Active years
                  </p>
  
                  <p className="mt-2 text-2xl font-bold text-emerald-400">
                    {
                      activeAcademicYearsCount
                    }
                  </p>
                </div>
              </section>
            )}
  
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#2b2d31] shadow-xl">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
                <div>
                  <h2 className="font-bold text-white">
                    Department Academic
                    Years
                  </h2>
  
                  <p className="mt-1 text-xs text-[#949ba4]">
                    Years are generated from
                    department duration and
                    displayed by sort order.
                  </p>
                </div>
  
                <button
                  type="button"
                  onClick={() =>
                    loadAcademicYears(
                      selectedDepartmentId
                    )
                  }
                  disabled={
                    !selectedDepartmentId ||
                    isLoadingYears
                  }
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoadingYears
                    ? "Loading..."
                    : "Refresh"}
                </button>
              </div>
  
              {isLoadingYears ? (
                <div className="flex min-h-64 items-center justify-center p-8">
                  <div className="text-center">
                    <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-white/20 border-t-purple-400" />
  
                    <p className="mt-4 text-sm text-[#b5bac1]">
                      Loading academic
                      years...
                    </p>
                  </div>
                </div>
              ) : academicYears.length ===
                0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
                  <h3 className="text-lg font-bold text-white">
                    No academic years found
                  </h3>
  
                  <p className="mt-2 max-w-md text-sm leading-6 text-[#949ba4]">
                    Check the selected
                    department duration and
                    save the department again
                    to generate its missing
                    academic years.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-white/10">
                    <thead className="bg-black/20">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#949ba4]">
                          Year
                        </th>
  
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#949ba4]">
                          Sort order
                        </th>
  
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#949ba4]">
                          Status
                        </th>
  
                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#949ba4]">
                          Action
                        </th>
                      </tr>
                    </thead>
  
                    <tbody className="divide-y divide-white/10">
                      {academicYears.map(
                        (academicYear) => {
                          const academicYearId =
                            academicYear._id ||
                            academicYear.id;
  
                          const isToggling =
                            togglingYearId ===
                            academicYearId;
  
                          return (
                            <tr
                              key={
                                academicYearId
                              }
                              className="transition hover:bg-white/[0.03]"
                            >
                              <td className="px-5 py-4">
                                <p className="font-semibold text-white">
                                  {
                                    academicYear.name
                                  }
                                </p>
  
                                <p className="mt-1 text-xs text-[#949ba4]">
                                  Year number:{" "}
                                  {
                                    academicYear.yearNumber
                                  }
                                </p>
                              </td>
  
                              <td className="px-5 py-4 text-sm text-[#b5bac1]">
                                {academicYear.sortOrder ??
                                  academicYear.yearNumber}
                              </td>
  
                              <td className="px-5 py-4">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleStatus(
                                      academicYear
                                    )
                                  }
                                  disabled={
                                    isToggling
                                  }
                                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                    academicYear.isActive
                                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
                                      : "border-white/10 bg-white/5 text-[#b5bac1] hover:bg-white/10"
                                  }`}
                                >
                                  {isToggling
                                    ? "Updating..."
                                    : academicYear.isActive
                                      ? "Active"
                                      : "Inactive"}
                                </button>
                              </td>
  
                              <td className="px-5 py-4 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenEditForm(
                                      academicYear
                                    )
                                  }
                                  className="rounded-lg border border-purple-400/20 bg-purple-400/10 px-3 py-2 text-xs font-semibold text-purple-300 transition hover:bg-purple-400/20"
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
  
          <aside>
            <div className="sticky top-6 rounded-2xl border border-white/10 bg-[#2b2d31] p-5 shadow-xl">
              {isFormOpen &&
              selectedAcademicYear ? (
                <>
                  <div className="mb-5 border-b border-white/10 pb-4">
                    <h2 className="text-lg font-bold text-white">
                      Edit Academic Year
                    </h2>
  
                    <p className="mt-1 text-sm text-[#949ba4]">
                      {selectedDepartment
                        ? `${selectedDepartment.name} (${selectedDepartment.code})`
                        : "Department unavailable"}
                    </p>
                  </div>
  
                  <AcademicYearForm
                    academicYear={
                      selectedAcademicYear
                    }
                    isSubmitting={
                      isSubmitting
                    }
                    onSubmit={
                      handleSubmit
                    }
                    onCancel={
                      handleCloseForm
                    }
                  />
                </>
              ) : (
                <div className="py-10 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10 text-xl text-purple-300">
                    ✎
                  </div>
  
                  <h2 className="mt-4 text-lg font-bold text-white">
                    Edit Academic Year
                  </h2>
  
                  <p className="mt-2 text-sm leading-6 text-[#949ba4]">
                    Select Edit beside an
                    academic year to change
                    its name, sort order, or
                    active status.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </DashboardLayout>
    );
  };
  
  export default AcademicYearsPage;
