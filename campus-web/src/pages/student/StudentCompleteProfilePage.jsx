import {
    useEffect,
    useState,
  } from "react";
  
  import {
    useNavigate,
  } from "react-router-dom";
  
  import toast from "react-hot-toast";
  
  import useAuth from "../../hooks/useAuth.js";
  
  import {
    completeStudentProfile,
    getDepartmentYears,
    getProfileDepartments,
  } from "../../services/profileService.js";
  
  import getErrorMessage from "../../utils/getErrorMessage.js";
  
  const StudentCompleteProfilePage = () => {
    const navigate = useNavigate();
  
    const {
      logout,
      updateUser,
    } = useAuth();
  
    const [
      departments,
      setDepartments,
    ] = useState([]);
  
    const [
      academicYears,
      setAcademicYears,
    ] = useState([]);
  
    const [
      selectedDepartment,
      setSelectedDepartment,
    ] = useState("");
  
    const [
      selectedYear,
      setSelectedYear,
    ] = useState("");
  
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
  
    useEffect(() => {
      const loadDepartments = async () => {
        try {
          setIsLoadingDepartments(true);
  
          const departmentList =
            await getProfileDepartments();
  
          setDepartments(
            Array.isArray(departmentList)
              ? departmentList
              : []
          );
        } catch (error) {
          toast.error(getErrorMessage(error), {
            id: "student-profile-departments",
          });
        } finally {
          setIsLoadingDepartments(false);
        }
      };
  
      loadDepartments();
    }, []);
  
    useEffect(() => {
      const loadAcademicYears = async () => {
        if (!selectedDepartment) {
          setAcademicYears([]);
          setSelectedYear("");
  
          return;
        }
  
        try {
          setIsLoadingYears(true);
          setSelectedYear("");
  
          const yearList =
            await getDepartmentYears(
              selectedDepartment
            );
  
          setAcademicYears(
            Array.isArray(yearList)
              ? yearList
              : []
          );
        } catch (error) {
          setAcademicYears([]);
  
          toast.error(getErrorMessage(error), {
            id: "student-profile-years",
          });
        } finally {
          setIsLoadingYears(false);
        }
      };
  
      loadAcademicYears();
    }, [selectedDepartment]);
  
    const handleSubmit = async (
      event
    ) => {
      event.preventDefault();
  
      if (!selectedDepartment) {
        toast.error(
          "Please select a department"
        );
  
        return;
      }
  
      if (!selectedYear) {
        toast.error(
          "Please select an academic year"
        );
  
        return;
      }
  
      try {
        setIsSubmitting(true);
  
        const updatedUser = await completeStudentProfile({
          department:
            selectedDepartment,
  
          year: Number(
            selectedYear
          ),
        });
  
        if (updatedUser) {
          updateUser(updatedUser);
        }
  
        toast.success(
          "Profile completed successfully"
        );
  
        navigate(
          "/student/dashboard",
          {
            replace: true,
          }
        );
      } catch (error) {
        toast.error(
          getErrorMessage(error)
        );
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleLogout = async () => {
      try {
        await logout();
        navigate("/login", { replace: true });
      } catch (error) {
        toast.error(
          getErrorMessage(error, "Unable to log out")
        );
      }
    };
  
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#313338] px-4 py-10 text-white">
        <section className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#1e1f22] p-6 shadow-2xl sm:p-8">
          <div className="mb-8">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-purple-400">
              Student profile
            </p>
  
            <h1 className="text-3xl font-bold">
              Complete your profile
            </h1>
  
            <p className="mt-3 text-sm leading-6 text-white/60">
              Select your department and
              current academic year to
              continue to your dashboard.
            </p>
          </div>
  
          <form
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <div>
              <label
                htmlFor="department"
                className="mb-2 block text-sm font-medium text-white/80"
              >
                Department
              </label>
  
              <select
                id="department"
                value={
                  selectedDepartment
                }
                onChange={(event) =>
                  setSelectedDepartment(
                    event.target.value
                  )
                }
                disabled={
                  isLoadingDepartments ||
                  isSubmitting
                }
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option
                  value=""
                  className="bg-[#1e1f22]"
                >
                  {isLoadingDepartments
                    ? "Loading departments..."
                    : "Select department"}
                </option>
  
                {departments.map(
                  (department) => (
                    <option
                      key={
                        department._id
                      }
                      value={
                        department._id
                      }
                      className="bg-[#1e1f22]"
                    >
                      {department.name}
                    </option>
                  )
                )}
              </select>
            </div>
  
            <div>
              <label
                htmlFor="academicYear"
                className="mb-2 block text-sm font-medium text-white/80"
              >
                Academic year
              </label>
  
              <select
                id="academicYear"
                value={selectedYear}
                onChange={(event) =>
                  setSelectedYear(
                    event.target.value
                  )
                }
                disabled={
                  !selectedDepartment ||
                  isLoadingYears ||
                  isSubmitting
                }
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option
                  value=""
                  className="bg-[#1e1f22]"
                >
                  {isLoadingYears
                    ? "Loading academic years..."
                    : "Select academic year"}
                </option>
  
                {academicYears.map(
                  (academicYear) => (
                    <option
                      key={
                        academicYear._id
                      }
                      value={
                        academicYear.yearNumber
                      }
                      className="bg-[#1e1f22]"
                    >
                      {academicYear.name ||
                        `Year ${academicYear.yearNumber}`}
                    </option>
                  )
                )}
              </select>
  
              {selectedDepartment &&
                !isLoadingYears &&
                academicYears.length ===
                  0 && (
                  <p className="mt-2 text-sm text-yellow-300">
                    No active academic
                    years are available for
                    this department.
                  </p>
                )}
            </div>
  
            <button
              type="submit"
              disabled={
                isSubmitting ||
                isLoadingDepartments ||
                isLoadingYears ||
                !selectedDepartment ||
                !selectedYear
              }
              className="w-full rounded-xl bg-purple-600 px-4 py-3 font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? "Saving profile..."
                : "Complete profile"}
            </button>
          </form>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isSubmitting}
            className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Log out
          </button>
        </section>
      </main>
    );
  };
  
  export default StudentCompleteProfilePage;
