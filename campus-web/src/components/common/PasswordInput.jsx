import {
    forwardRef,
    useState,
  } from "react";
  import {
    FiEye,
    FiEyeOff,
  } from "react-icons/fi";
  
  const PasswordInput = forwardRef(
    (
      {
        id,
        error,
        disabled,
        placeholder,
        autoComplete = "current-password",
        ...inputProps
      },
      ref
    ) => {
      const [showPassword, setShowPassword] =
        useState(false);
  
      return (
        <div
          className={`flex items-center rounded-xl border bg-black/20 transition focus-within:ring-2 ${
            error
              ? "border-red-500 focus-within:ring-red-500/30"
              : "border-white/10 focus-within:border-purple-400 focus-within:ring-purple-400/20"
          }`}
        >
          <input
            {...inputProps}
            ref={ref}
            id={id}
            type={
              showPassword
                ? "text"
                : "password"
            }
            disabled={disabled}
            placeholder={placeholder}
            autoComplete={autoComplete}
            className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
          />
  
          <button
            type="button"
            disabled={disabled}
            aria-label={
              showPassword
                ? "Hide password"
                : "Show password"
            }
            onClick={() =>
              setShowPassword(
                (currentValue) =>
                  !currentValue
              )
            }
            className="mr-2 rounded p-2 text-[#949ba4] transition hover:bg-[#2b2d31] hover:text-white disabled:cursor-not-allowed"
          >
            {showPassword ? (
              <FiEyeOff size={18} />
            ) : (
              <FiEye size={18} />
            )}
          </button>
        </div>
      );
    }
  );
  
  PasswordInput.displayName =
    "PasswordInput";
  
  export default PasswordInput;