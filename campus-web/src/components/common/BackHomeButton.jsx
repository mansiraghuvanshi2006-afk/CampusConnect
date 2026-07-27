import { FiArrowLeft } from "react-icons/fi";
import { Link } from "react-router-dom";

const BackHomeButton = ({ className = "" }) => {
  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-blue-100/80 transition hover:border-purple-400/40 hover:bg-white/10 hover:text-white ${className}`}
    >
      <FiArrowLeft size={16} />
      Back to home
    </Link>
  );
};

export default BackHomeButton;
