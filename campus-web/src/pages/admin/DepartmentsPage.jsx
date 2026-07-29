import {
    useCallback,
    useEffect,
    useState,
  } from "react";
  
  import toast from "react-hot-toast";
  
  import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
  import DepartmentForm from "../../components/admin/DepartmentForm.jsx";
  import DepartmentTable from "../../components/admin/DepartmentTable.jsx";
  
  import {
    createDepartment,
    deleteDepartment,
    getDepartments,
    updateDepartment,
  } from "../../services/departmentService.js";
  
  import getErrorMessage from "../../utils/getErrorMessage.js";
  
  const initialPagination = {
    currentPage: 1,
    totalPages: 1,
    totalDepartments: 0,
    limit: 10,
    hasNextPage: false,
    hasPreviousPage: false,
  };
  
  const DepartmentsPage = () => {
    const [departments, setDepartments] =
      useState([]);
  
    const [pagination, setPagination] =
      useState(initialPagination);
  
    const [searchInput, setSearchInput] =
      useState("");
  
    const [search, setSearch] =
      useState("");
  
    const [status, setStatus] =
      useState("all");
  
    const [sort, setSort] =
      useState("name");
  
    const [page, setPage] =
      useState(1);
  
    const [isLoading, setIsLoading] =
      useState(true);
  
    const [error, setError] =
      useState("");
  
    const [isFormOpen, setIsFormOpen] =
      useState(false);
  
    const [
      selectedDepartment,
      setSelectedDepartment,
    ] = useState(null);
  
    const [
      isSubmitting,
      setIsSubmitting,
    ] = useState(false);
  
    const [
      deletingDepartment,
      setDeletingDepartment,
    ] = useState(null);
  
    const [
      deletingDepartmentId,
      setDeletingDepartmentId,
    ] = useState(null);
  
    const loadDepartments = useCallback(
      async () => {
        try {
          setIsLoading(true);
          setError("");
  
          const data = await getDepartments({
            search,
            status,
            sort,
            page,
            limit: 10,
          });
  
          setDepartments(
            data?.departments || []
          );
  
          setPagination(
            data?.pagination ||
              initialPagination
          );
        } catch (error) {
          const message =
            getErrorMessage(
              error,
              "Unable to load departments"
            );
  
          setError(message);
          toast.error(message);
        } finally {
          setIsLoading(false);
        }
      },
      [
        search,
        status,
        sort,
        page,
      ]
    );
  
    useEffect(() => {
      const timeoutId = window.setTimeout(
        loadDepartments,
        0
      );

      return () => window.clearTimeout(timeoutId);
    }, [loadDepartments]);
  
    const openCreateForm = () => {
      setSelectedDepartment(null);
      setIsFormOpen(true);
    };
  
    const openEditForm = (
      department
    ) => {
      setSelectedDepartment(
        department
      );
  
      setIsFormOpen(true);
    };
  
    const closeForm = () => {
      if (isSubmitting) {
        return;
      }
  
      setIsFormOpen(false);
      setSelectedDepartment(null);
    };
  
    const handleFormSubmit = async (
      departmentData
    ) => {
      try {
        setIsSubmitting(true);
  
        const departmentId =
          selectedDepartment?._id ||
          selectedDepartment?.id;
  
        let response;
  
        if (departmentId) {
          response =
            await updateDepartment(
              departmentId,
              departmentData
            );
        } else {
          response =
            await createDepartment(
              departmentData
            );
        }
  
        toast.success(
          response?.message ||
            (departmentId
              ? "Department updated successfully"
              : "Department created successfully")
        );
  
        closeForm();
  
        if (!departmentId) {
          setPage(1);
        }
  
        await loadDepartments();
      } catch (error) {
        toast.error(
          getErrorMessage(
            error,
            selectedDepartment
              ? "Unable to update department"
              : "Unable to create department"
          )
        );
      } finally {
        setIsSubmitting(false);
      }
    };
  
    const openDeleteDialog = (
      department
    ) => {
      setDeletingDepartment(
        department
      );
    };
  
    const closeDeleteDialog = () => {
      if (deletingDepartmentId) {
        return;
      }
  
      setDeletingDepartment(null);
    };
  
    const handleDelete = async () => {
      const departmentId =
        deletingDepartment?._id ||
        deletingDepartment?.id;
  
      if (!departmentId) {
        return;
      }
  
      try {
        setDeletingDepartmentId(
          departmentId
        );
  
        const response =
          await deleteDepartment(
            departmentId
          );
  
        toast.success(
          response?.message ||
            "Department deleted successfully"
        );
  
        setDeletingDepartment(null);
  
        const isLastItemOnPage =
          departments.length === 1 &&
          page > 1;
  
        if (isLastItemOnPage) {
          setPage((current) =>
            Math.max(current - 1, 1)
          );
  
          return;
        }
  
        await loadDepartments();
      } catch (error) {
        toast.error(
          getErrorMessage(
            error,
            "Unable to delete department"
          )
        );
      } finally {
        setDeletingDepartmentId(
          null
        );
      }
    };
  
    const handleSearchSubmit = (
      event
    ) => {
      event.preventDefault();
  
      setPage(1);
      setSearch(
        searchInput.trim()
      );
    };
  
    const handleClearSearch = () => {
      setSearchInput("");
      setSearch("");
      setPage(1);
    };
  
    const handleStatusChange = (
      event
    ) => {
      setStatus(event.target.value);
      setPage(1);
    };
  
    const handleSortChange = (
      event
    ) => {
      setSort(event.target.value);
      setPage(1);
    };
  
    return (
      <DashboardLayout
        title="Departments"
        description="Create and manage campus departments."
      >
        <section className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#2b2d31] p-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1">
            <form
              onSubmit={
                handleSearchSubmit
              }
              className="flex flex-col gap-3 sm:flex-row"
            >
              <div className="flex-1">
                <label
                  htmlFor="department-search"
                  className="mb-2 block text-sm font-semibold text-white"
                >
                  Search departments
                </label>
  
                <input
                  id="department-search"
                  type="search"
                  value={searchInput}
                  onChange={(event) =>
                    setSearchInput(
                      event.target.value
                    )
                  }
                  placeholder="Search by name or code"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                />
              </div>
  
              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
                >
                  Search
                </button>
  
                {search && (
                  <button
                    type="button"
                    onClick={
                      handleClearSearch
                    }
                    className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Clear
                  </button>
                )}
              </div>
            </form>
          </div>
  
          <button
            type="button"
            onClick={openCreateForm}
            className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
          >
            Add Department
          </button>
        </section>
  
        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label
              htmlFor="department-status"
              className="mb-2 block text-sm font-semibold text-white"
            >
              Status
            </label>
  
            <select
              id="department-status"
              value={status}
              onChange={
                handleStatusChange
              }
              className="w-full rounded-xl border border-white/10 bg-[#2b2d31] px-4 py-3 text-sm text-white outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
            >
              <option value="all">
                All departments
              </option>
  
              <option value="active">
                Active
              </option>
  
              <option value="inactive">
                Inactive
              </option>
            </select>
          </div>
  
          <div>
            <label
              htmlFor="department-sort"
              className="mb-2 block text-sm font-semibold text-white"
            >
              Sort
            </label>
  
            <select
              id="department-sort"
              value={sort}
              onChange={
                handleSortChange
              }
              className="w-full rounded-xl border border-white/10 bg-[#2b2d31] px-4 py-3 text-sm text-white outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
            >
              <option value="name">
                Name
              </option>
  
              <option value="code">
                Code
              </option>
  
              <option value="newest">
                Newest first
              </option>
  
              <option value="oldest">
                Oldest first
              </option>
            </select>
          </div>
  
          <div className="flex items-end">
            <div className="w-full rounded-xl border border-white/10 bg-[#2b2d31] px-4 py-3">
              <p className="text-xs text-[#b5bac1]">
                Total departments
              </p>
  
              <p className="mt-1 text-xl font-bold text-white">
                {
                  pagination.totalDepartments
                }
              </p>
            </div>
          </div>
        </section>
  
        {error && !isLoading && (
          <section className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-5">
            <p className="font-semibold text-red-300">
              Unable to load
              departments
            </p>
  
            <p className="mt-1 text-sm text-red-200/80">
              {error}
            </p>
  
            <button
              type="button"
              onClick={
                loadDepartments
              }
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Try again
            </button>
          </section>
        )}
  
        {!error && (
          <DepartmentTable
            departments={departments}
            isLoading={isLoading}
            deletingDepartmentId={
              deletingDepartmentId
            }
            onEdit={openEditForm}
            onDelete={
              openDeleteDialog
            }
          />
        )}
  
        {!isLoading &&
          !error &&
          pagination.totalPages > 1 && (
            <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#2b2d31] p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[#b5bac1]">
                Page{" "}
                {
                  pagination.currentPage
                }{" "}
                of{" "}
                {pagination.totalPages}
              </p>
  
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={
                    !pagination.hasPreviousPage
                  }
                  onClick={() =>
                    setPage((current) =>
                      Math.max(
                        current - 1,
                        1
                      )
                    )
                  }
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
  
                <button
                  type="button"
                  disabled={
                    !pagination.hasNextPage
                  }
                  onClick={() =>
                    setPage((current) =>
                      current + 1
                    )
                  }
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </section>
          )}
  
        {isFormOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-8"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeForm();
              }
            }}
          >
            <section className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#2b2d31] p-6 shadow-2xl">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {selectedDepartment
                    ? "Edit Department"
                    : "Create Department"}
                </h2>
  
                <p className="mt-2 text-sm text-[#b5bac1]">
                  {selectedDepartment
                    ? "Update the selected department information."
                    : "Add a new department to CampusConnect."}
                </p>
              </div>
  
              <DepartmentForm
                department={
                  selectedDepartment
                }
                isSubmitting={
                  isSubmitting
                }
                onSubmit={
                  handleFormSubmit
                }
                onCancel={closeForm}
              />
            </section>
          </div>
        )}
  
        {deletingDepartment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#2b2d31] p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-white">
                Delete Department
              </h2>
  
              <p className="mt-3 text-sm leading-6 text-[#b5bac1]">
                Are you sure you want to
                delete{" "}
                <span className="font-semibold text-white">
                  {
                    deletingDepartment.name
                  }
                </span>
                ? This action cannot be
                undone.
              </p>
  
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={
                    closeDeleteDialog
                  }
                  disabled={
                    Boolean(
                      deletingDepartmentId
                    )
                  }
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>
  
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={
                    Boolean(
                      deletingDepartmentId
                    )
                  }
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingDepartmentId
                    ? "Deleting..."
                    : "Delete Department"}
                </button>
              </div>
            </section>
          </div>
        )}
      </DashboardLayout>
    );
  };
  
  export default DepartmentsPage;
