import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import GuestRoute from "./GuestRoute.jsx";
import ProtectedRoute from "./ProtectedRoute.jsx";

import PublicLayout from "../layouts/PublicLayout.jsx";

import LandingPage from "../pages/public/LandingPage.jsx";
import AboutPage from "../pages/public/AboutPage.jsx";
import ContactPage from "../pages/public/ContactPage.jsx";
import DeveloperPage from "../pages/public/DeveloperPage.jsx";
import PrivacyPage from "../pages/public/PrivacyPage.jsx";
import TermsPage from "../pages/public/TermsPage.jsx";

import LoginPage from "../pages/auth/LoginPage.jsx";
import RegisterPage from "../pages/auth/RegisterPage.jsx";
import RegistrationSuccessPage from "../pages/auth/RegistrationSuccessPage.jsx";
import VerifyEmailPage from "../pages/auth/VerifyEmailPage.jsx";

import AdminLoginPage from "../pages/admin/AdminLoginPage.jsx";
import AdminDashboard from "../pages/admin/AdminDashboard.jsx";
import DepartmentsPage from "../pages/admin/DepartmentsPage.jsx";
import AcademicYearsPage from "../pages/admin/AcademicYearsPage.jsx";
import AdminUsersPage from "../pages/admin/AdminUsersPage.jsx";

import StudentDashboard from "../pages/student/StudentDashboard.jsx";
import StudentCompleteProfilePage from "../pages/student/StudentCompleteProfilePage.jsx";

import TeacherDashboard from "../pages/teacher/TeacherDashboard.jsx";
import TeacherCompleteProfilePage from "../pages/teacher/TeacherCompleteProfilePage.jsx";
import TeacherApprovalPendingPage from "../pages/teacher/TeacherApprovalPendingPage.jsx";
import TeacherApprovalRejectedPage from "../pages/teacher/TeacherApprovalRejectedPage.jsx";

import NotFoundPage from "../pages/NotFoundPage.jsx";

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public pages */}
      <Route element={<PublicLayout />}>
        <Route
          path="/"
          element={<LandingPage />}
        />

        <Route
          path="/about"
          element={<AboutPage />}
        />

        <Route
          path="/contact"
          element={<ContactPage />}
        />

        <Route
          path="/developer"
          element={<DeveloperPage />}
        />

        <Route
          path="/privacy"
          element={<PrivacyPage />}
        />

        <Route
          path="/terms"
          element={<TermsPage />}
        />
      </Route>

      {/* Guest-only authentication pages */}
      <Route element={<GuestRoute />}>
        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/register"
          element={<RegisterPage />}
        />

        <Route
          path="/registration-success"
          element={<RegistrationSuccessPage />}
        />

        <Route
          path="/verify-email"
          element={<VerifyEmailPage />}
        />

        <Route
          path="/admin/login"
          element={<AdminLoginPage />}
        />
      </Route>

      {/* Student routes */}
      <Route
        element={
          <ProtectedRoute
            allowedRoles={["student"]}
          />
        }
      >
        <Route
          path="/student/complete-profile"
          element={<StudentCompleteProfilePage />}
        />

        <Route
          path="/student/dashboard"
          element={<StudentDashboard />}
        />
      </Route>

      {/* Teacher routes */}
      <Route
        element={
          <ProtectedRoute
            allowedRoles={["teacher"]}
          />
        }
      >
        <Route
          path="/teacher/complete-profile"
          element={<TeacherCompleteProfilePage />}
        />

        <Route
          path="/teacher/approval-pending"
          element={<TeacherApprovalPendingPage />}
        />

        <Route
          path="/teacher/approval-rejected"
          element={<TeacherApprovalRejectedPage />}
        />

        <Route
          path="/teacher/dashboard"
          element={<TeacherDashboard />}
        />
      </Route>

      {/* Admin routes */}
      <Route
        element={
          <ProtectedRoute
            allowedRoles={["admin"]}
          />
        }
      >
        <Route
          path="/admin/dashboard"
          element={<AdminDashboard />}
        />

        <Route
          path="/admin/departments"
          element={<DepartmentsPage />}
        />

        <Route
          path="/admin/academic-years"
          element={<AcademicYearsPage />}
        />

        <Route
          path="/admin/users"
          element={<AdminUsersPage />}
        />
      </Route>

      {/* Redirect short URLs */}
      <Route
        path="/student"
        element={
          <Navigate
            to="/student/dashboard"
            replace
          />
        }
      />

      <Route
        path="/teacher"
        element={
          <Navigate
            to="/teacher/dashboard"
            replace
          />
        }
      />

      <Route
        path="/admin"
        element={
          <Navigate
            to="/admin/dashboard"
            replace
          />
        }
      />

      {/* 404 page */}
      <Route
        path="*"
        element={<NotFoundPage />}
      />
    </Routes>
  );
};

export default AppRoutes;