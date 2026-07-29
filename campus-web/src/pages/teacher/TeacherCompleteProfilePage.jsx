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
    completeTeacherProfile,
    getDepartmentYears,
    getProfileDepartments,
  } from "../../services/profileService.js";
  
  import getErrorMessage from "../../utils/getErrorMessage.js";
  
  const TeacherCompleteProfilePage = () => {
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
      selectedTeachingYears,
      setSelectedTeachingYears,
    ] = useState([]);
  
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
            id: "teacher-profile-departments",
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
          setSelectedTeachingYears([]);
  
          return;
        }
  
        try {
          setIsLoadingYears(true);
          setSelectedTeachingYears([]);
  
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
            id: "teacher-profile-years",
          });
        } finally {
          setIsLoadingYears(false);
        }
      };
  
      loadAcademicYears();
    }, [selectedDepartment]);
  
    const handleTeachingYearChange = (
      yearNumber
    ) => {
      setSelectedTeachingYears(
        (currentYears) => {
          if (
            currentYears.includes(
              yearNumber
            )
          ) {
            return currentYears.filter(
              (year) =>
                year !== yearNumber
            );
          }
  
          return [
            ...currentYears,
            yearNumber,
          ].sort(
            (firstYear, secondYear) =>
              firstYear - secondYear
          );
        }
      );
    };
  
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
  
      if (
        selectedTeachingYears.length ===
        0
      ) {
        toast.error(
          "Select at least one teaching year"
        );
  
        return;
      }
  
      try {
        setIsSubmitting(true);
  
        const updatedUser = await completeTeacherProfile({
          department:
            selectedDepartment,
  
          teachingYears:
            selectedTeachingYears,
        });
  
        if (updatedUser) {
          updateUser(updatedUser);
        }
  
        toast.success(
          "Profile submitted for approval"
        );
  
        navigate(
          "/teacher/approval-pending",
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
        <section className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#1e1f22] p-6 shadow-2xl sm:p-8">
          <div className="mb-8">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-purple-400">
              Teacher profile
            </p>
  
            <h1 className="text-3xl font-bold">
              Complete your profile
            </h1>
  
            <p className="mt-3 text-sm leading-6 text-white/60">
              Select your department and
              the academic years you teach.
              Your profile will then be sent
              to the administrator for
              approval.
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
              <p className="mb-3 text-sm font-medium text-white/80">
                Teaching years
              </p>
  
              {!selectedDepartment && (
                <div className="rounded-xl border border-dashed border-white/10 bg-black/10 p-4 text-sm text-white/50">
                  Select a department first.
                </div>
              )}
  
              {selectedDepartment &&
                isLoadingYears && (
                  <div className="rounded-xl border border-white/10 bg-black/10 p-4 text-sm text-white/60">
                    Loading academic years...
                  </div>
                )}
  
              {selectedDepartment &&
                !isLoadingYears &&
                academicYears.length ===
                  0 && (
                  <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-200">
                    No active academic years
                    are available for this
                    department.
                  </div>
                )}
  
              {selectedDepartment &&
                !isLoadingYears &&
                academicYears.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {academicYears.map(
                      (academicYear) => {
                        const yearNumber =
                          Number(
                            academicYear.yearNumber
                          );
  
                        const isSelected =
                          selectedTeachingYears.includes(
                            yearNumber
                          );
  
                        return (
                          <label
                            key={
                              academicYear._id
                            }
                            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
                              isSelected
                                ? "border-purple-400 bg-purple-500/15"
                                : "border-white/10 bg-black/10 hover:border-white/20"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={
                                isSelected
                              }
                              onChange={() =>
                                handleTeachingYearChange(
                                  yearNumber
                                )
                              }
                              disabled={
                                isSubmitting
                              }
                              className="h-4 w-4 accent-purple-500"
                            />
  
                            <span className="text-sm font-medium">
                              {academicYear.name ||
                                `Year ${yearNumber}`}
                            </span>
                          </label>
                        );
                      }
                    )}
                  </div>
                )}
            </div>
  
            <button
              type="submit"
              disabled={
                isSubmitting ||
                isLoadingDepartments ||
                isLoadingYears ||
                !selectedDepartment ||
                selectedTeachingYears.length ===
                  0
              }
              className="w-full rounded-xl bg-purple-600 px-4 py-3 font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? "Submitting profile..."
                : "Submit for approval"}
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
  
  export default TeacherCompleteProfilePage;
