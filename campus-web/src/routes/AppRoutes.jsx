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

import StudentDashboard from "../pages/student/StudentDashboard.jsx";
import TeacherDashboard from "../pages/teacher/TeacherDashboard.jsx";
import AdminDashboard from "../pages/admin/AdminDashboard.jsx";

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
          element={
            <RegistrationSuccessPage />
          }
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
      </Route>

      {/* Redirect old dashboard URLs */}
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