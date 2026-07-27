import { useState } from "react";
import {
  FiMenu,
  FiX,
} from "react-icons/fi";
import {
  Link,
  NavLink,
} from "react-router-dom";

import campusLogo from "../../assets/campus-logo.png";

const navigationLinks = [
  {
    label: "Home",
    path: "/",
  },
  {
    label: "About",
    path: "/about",
  },
  {
    label: "Contact",
    path: "/contact",
  },
  {
    label: "Developer",
    path: "/developer",
  },
];

const PublicHeader = () => {
  const [isMenuOpen, setIsMenuOpen] =
    useState(false);

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const getNavLinkClass = ({
    isActive,
  }) => {
    return `relative w-fit text-sm font-medium transition ${
      isActive
        ? "text-white after:absolute after:-bottom-2 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-gradient-to-r after:from-blue-400 after:to-purple-500"
        : "text-blue-100/60 hover:text-white"
    }`;
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0d1028]/90 shadow-[0_8px_30px_rgba(38,45,120,0.15)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          onClick={closeMenu}
          className="flex items-center gap-3"
        >
          <img
            src={campusLogo}
            alt="CampusConnect"
            className="h-10 w-10 object-contain"
          />

          <span className="text-lg font-bold text-white">
            CampusConnect
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navigationLinks.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={getNavLinkClass}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/login"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-blue-100/80 transition hover:border-purple-400/40 hover:bg-white/5 hover:text-white"
          >
            Login
          </Link>

          <Link
            to="/register"
            className="gradient-button rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-md shadow-purple-950/20 transition hover:-translate-y-0.5"
          >
            Register
          </Link>

          <Link
            to="/admin/login"
            className="rounded-xl border border-purple-400/30 px-4 py-2 text-sm font-semibold text-white transition hover:border-purple-400/60 hover:bg-purple-500/10"
          >
            Admin Portal
          </Link>
        </div>

        <button
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={isMenuOpen}
          onClick={() =>
            setIsMenuOpen(
              (currentValue) =>
                !currentValue
            )
          }
          className="rounded-xl p-2 text-blue-100/70 transition hover:bg-white/5 hover:text-white md:hidden"
        >
          {isMenuOpen ? (
            <FiX size={23} />
          ) : (
            <FiMenu size={23} />
          )}
        </button>
      </div>

      {isMenuOpen && (
        <div className="border-t border-white/10 bg-[#0d1028]/95 px-4 py-5 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-4">
            {navigationLinks.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={closeMenu}
                className={getNavLinkClass}
              >
                {item.label}
              </NavLink>
            ))}

            <div className="mt-2 grid gap-3 border-t border-white/10 pt-4">
              <Link
                to="/login"
                onClick={closeMenu}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Student / Teacher Login
              </Link>

              <Link
                to="/register"
                onClick={closeMenu}
                className="gradient-button rounded-xl px-4 py-3 text-center text-sm font-semibold text-white"
              >
                Register
              </Link>

              <Link
                to="/admin/login"
                onClick={closeMenu}
                className="rounded-xl border border-purple-400/30 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-purple-500/10"
              >
                Administrator Portal
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default PublicHeader;