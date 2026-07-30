import {
  lazy,
  Suspense,
} from "react";

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
import ChangeTemporaryPasswordPage from "../pages/auth/ChangeTemporaryPasswordPage.jsx";

import AdminLoginPage from "../pages/admin/AdminLoginPage.jsx";

import StudentCompleteProfilePage from "../pages/student/StudentCompleteProfilePage.jsx";

import TeacherCompleteProfilePage from "../pages/teacher/TeacherCompleteProfilePage.jsx";
import TeacherApprovalPendingPage from "../pages/teacher/TeacherApprovalPendingPage.jsx";
import TeacherApprovalRejectedPage from "../pages/teacher/TeacherApprovalRejectedPage.jsx";

import NotFoundPage from "../pages/NotFoundPage.jsx";

const StudentDashboard = lazy(
  () => import("../pages/student/StudentDashboard.jsx")
);

const TeacherDashboard = lazy(
  () => import("../pages/teacher/TeacherDashboard.jsx")
);

const AdminDashboard = lazy(
  () => import("../pages/admin/AdminDashboard.jsx")
);

const DepartmentsPage = lazy(
  () => import("../pages/admin/DepartmentsPage.jsx")
);

const AcademicYearsPage = lazy(
  () => import("../pages/admin/AcademicYearsPage.jsx")
);

const AdminUsersPage = lazy(
  () => import("../pages/admin/AdminUsersPage.jsx")
);

const ChatPage = lazy(
  () => import("../pages/chat/ChatPage.jsx")
);

const CampusAiPage = lazy(
  () => import("../pages/ai/CampusAiPage.jsx")
);

const ProfilePage = lazy(
  () => import("../pages/profile/ProfilePage.jsx")
);

const SettingsPage = lazy(
  () => import("../pages/settings/SettingsPage.jsx")
);

const RouteFallback = () => (
  <div
    className="flex min-h-[50vh] items-center justify-center bg-[#313338] text-sm text-[#b5bac1]"
    role="status"
    aria-live="polite"
  >
    Loading page...
  </div>
);

const AppRoutes = () => {
  return (
    <Suspense fallback={<RouteFallback />}>
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
          path="/admin/login"
          element={<AdminLoginPage />}
        />
      </Route>

      {/* Email verification must stay public — GuestRoute redirects logged-in users (e.g. admin) to their dashboard and skips verification */}
      <Route
        path="/verify-email"
        element={<VerifyEmailPage />}
      />

      {/* Required first-login password change for every role */}
      <Route element={<ProtectedRoute />}>
        <Route
          path="/change-password"
          element={<ChangeTemporaryPasswordPage />}
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

        <Route
          path="/student/chat"
          element={<ChatPage />}
        />

        <Route
          path="/student/chat/:conversationId"
          element={<ChatPage />}
        />

        <Route
          path="/student/ai"
          element={<CampusAiPage />}
        />

        <Route
          path="/student/ai/:conversationId"
          element={<CampusAiPage />}
        />

        <Route
          path="/student/profile"
          element={<ProfilePage />}
        />

        <Route
          path="/student/settings"
          element={<SettingsPage />}
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

        <Route
          path="/teacher/chat"
          element={<ChatPage />}
        />

        <Route
          path="/teacher/chat/:conversationId"
          element={<ChatPage />}
        />

        <Route
          path="/teacher/ai"
          element={<CampusAiPage />}
        />

        <Route
          path="/teacher/ai/:conversationId"
          element={<CampusAiPage />}
        />

        <Route
          path="/teacher/profile"
          element={<ProfilePage />}
        />

        <Route
          path="/teacher/settings"
          element={<SettingsPage />}
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

        <Route
          path="/admin/chat"
          element={<ChatPage />}
        />

        <Route
          path="/admin/chat/:conversationId"
          element={<ChatPage />}
        />

        <Route
          path="/admin/ai"
          element={<CampusAiPage />}
        />

        <Route
          path="/admin/ai/:conversationId"
          element={<CampusAiPage />}
        />

        <Route
          path="/admin/profile"
          element={<ProfilePage />}
        />

        <Route
          path="/admin/settings"
          element={<SettingsPage />}
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
    </Suspense>
  );
};

export default AppRoutes;