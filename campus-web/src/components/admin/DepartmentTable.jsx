const DepartmentTable = ({
    departments = [],
    isLoading = false,
    deletingDepartmentId = null,
    onEdit,
    onDelete,
  }) => {
    if (isLoading) {
      return (
        <div className="rounded-2xl border border-white/10 bg-[#2b2d31] p-10 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-purple-400" />
  
          <p className="mt-4 text-sm text-[#b5bac1]">
            Loading departments...
          </p>
        </div>
      );
    }
  
    if (departments.length === 0) {
      return (
        <div className="rounded-2xl border border-white/10 bg-[#2b2d31] p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-purple-500/10 text-2xl text-purple-300">
            +
          </div>
  
          <h2 className="mt-4 text-xl font-bold text-white">
            No departments found
          </h2>
  
          <p className="mt-2 text-sm text-[#b5bac1]">
            Create your first department to start organizing students and teachers.
          </p>
        </div>
      );
    }
  
    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#2b2d31]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-black/20 text-xs uppercase tracking-wide text-[#b5bac1]">
              <tr>
                <th className="px-6 py-4">
                  Department
                </th>
  
                <th className="px-6 py-4">
                  Code
                </th>
  
                <th className="px-6 py-4">
                  Status
                </th>
  
                <th className="px-6 py-4">
                  Created
                </th>
  
                <th className="px-6 py-4 text-right">
                  Actions
                </th>
              </tr>
            </thead>
  
            <tbody>
              {departments.map((department) => {
                const departmentId =
                  department._id || department.id;
  
                const isDeleting =
                  deletingDepartmentId === departmentId;
  
                return (
                  <tr
                    key={departmentId}
                    className="border-t border-white/10"
                  >
                    <td className="px-6 py-5">
                      <p className="font-semibold text-white">
                        {department.name}
                      </p>
  
                      <p className="mt-1 max-w-md text-sm text-[#b5bac1]">
                        {department.description ||
                          "No description provided"}
                      </p>
                    </td>
  
                    <td className="px-6 py-5">
                      <span className="rounded-lg border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-purple-200">
                        {department.code}
                      </span>
                    </td>
  
                    <td className="px-6 py-5">
                      {department.isActive ? (
                        <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-200">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full border border-gray-500/30 bg-gray-500/10 px-3 py-1 text-xs font-semibold text-gray-300">
                          Inactive
                        </span>
                      )}
                    </td>
  
                    <td className="px-6 py-5 text-sm text-[#b5bac1]">
                      {department.createdAt
                        ? new Date(
                            department.createdAt
                          ).toLocaleDateString(
                            "en-IN",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            }
                          )
                        : "Unknown"}
                    </td>
  
                    <td className="px-6 py-5">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            onEdit(department)
                          }
                          disabled={isDeleting}
                          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Edit
                        </button>
  
                        <button
                          type="button"
                          onClick={() =>
                            onDelete(department)
                          }
                          disabled={isDeleting}
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isDeleting
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  
  export default DepartmentTable;