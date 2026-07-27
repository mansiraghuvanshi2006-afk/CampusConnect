import {
  FiFacebook,
    FiGithub,
    FiInstagram,
    FiLinkedin,
    FiMail,
  } from "react-icons/fi";
  import {
    Link,
  } from "react-router-dom";
  
  import campusLogo from "../../assets/campus-logo.png";
  
  const footerLinkClass =
    "inline-flex w-fit text-sm text-blue-100/60 transition hover:translate-x-1 hover:text-purple-300";
  
  const socialLinkClass =
    "flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-blue-100/60 transition hover:-translate-y-1 hover:border-purple-400/40 hover:bg-purple-500/10 hover:text-white";
  
  const PublicFooter = () => {
    const currentYear =
      new Date().getFullYear();
  
    return (
      <footer className="relative overflow-hidden border-t border-white/10 bg-[#080a18]">
        <div className="absolute left-1/2 top-0 h-32 w-[40rem] -translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl" />
  
        <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
  
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <Link
                to="/"
                className="flex w-fit items-center gap-3"
              >
                <img
                  src={campusLogo}
                  alt="CampusConnect"
                  className="h-11 w-11 object-contain"
                />
  
                <span className="text-lg font-bold text-white">
                  CampusConnect
                </span>
              </Link>
  
              <p className="mt-4 max-w-md text-sm leading-7 text-blue-100/60">
                A modern communication platform for
                students, teachers, administrators
                and campus departments.
              </p>
  
              <div className="mt-6 flex items-center gap-3">
                <a
                  href="https://github.com/mansiraghuvanshi2006-afk"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="GitHub"
                  className={socialLinkClass}
                >
                  <FiGithub size={19} />
                </a>
  
                <a
                  href="https://www.linkedin.com/in/mansi-thakur-014902298?utm_source=share_via&utm_content=profile&utm_medium=member_android"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="LinkedIn"
                  className={socialLinkClass}
                >
                  <FiLinkedin size={19} />
                </a>
  
                <a
                  href="https://www.instagram.com/___mansi__thakur___?igsh=MTJsdWR1M3MwNnMybw=="
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                  className={socialLinkClass}
                >
                  <FiInstagram size={19} />
                </a>
                <a
                  href="https://www.facebook.com/share/1FujGBUXhu/"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Facebook"
                  className={socialLinkClass}
                >
                  <FiFacebook size={19} />
                </a>
  
                <a
                  href="mailto:mansiraghuvanshi2006@gmail.com
"
                  aria-label="Email"
                  className={socialLinkClass}
                >
                  <FiMail size={19} />
                </a>
              </div>
            </div>
  
            <div>
              <h2 className="font-semibold text-white">
                Quick Links
              </h2>
  
              <div className="mt-4 flex flex-col gap-3">
                <Link
                  to="/about"
                  className={footerLinkClass}
                >
                  About
                </Link>
  
                <Link
                  to="/contact"
                  className={footerLinkClass}
                >
                  Contact
                </Link>
  
                <Link
                  to="/developer"
                  className={footerLinkClass}
                >
                  Developer
                </Link>
              </div>
            </div>
  
            <div>
              <h2 className="font-semibold text-white">
                Accounts
              </h2>
  
              <div className="mt-4 flex flex-col gap-3">
                <Link
                  to="/login"
                  className={footerLinkClass}
                >
                  Student / Teacher Login
                </Link>
  
                <Link
                  to="/register"
                  className={footerLinkClass}
                >
                  Register
                </Link>
  
                <Link
                  to="/admin/login"
                  className={footerLinkClass}
                >
                  Administrator Portal
                </Link>
              </div>
            </div>
          </div>
  
          <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-blue-100/45 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {currentYear} CampusConnect.
              All rights reserved.
            </p>
  
            <div className="flex items-center gap-5">
              <Link
                to="/privacy"
                className="transition hover:text-white"
              >
                Privacy
              </Link>
  
              <Link
                to="/terms"
                className="transition hover:text-white"
              >
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    );
  };
  
  export default PublicFooter;