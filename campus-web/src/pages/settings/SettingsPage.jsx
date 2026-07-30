import { useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import getErrorMessage from "../../utils/getErrorMessage.js";
import {
  applyTheme,
  storeTheme,
} from "../../utils/theme.js";
import {
  changePassword,
  clearAiHistoryFromSettings,
  getSettings,
  logoutAllDevices,
  updateSettings,
} from "../../services/settingsService.js";
import { ACCESS_TOKEN_KEY } from "../../services/api.js";

const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
    <span className="text-[#dbdee1]">{label}</span>
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 accent-purple-500"
    />
  </label>
);

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await getSettings();
        if (!cancelled) {
          setSettings(data);
        }
      } catch (error) {
        toast.error(getErrorMessage(error, "Unable to load settings"));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const persistSettings = async (patch) => {
    setSaving(true);
    try {
      const updated = await updateSettings(patch);
      setSettings(updated);

      if (patch.theme) {
        storeTheme(patch.theme);
        applyTheme(patch.theme);
        updateUser?.({
          settings: {
            ...(user?.settings || {}),
            theme: patch.theme,
            language: updated.language,
          },
        });
      }

      toast.success("Settings saved");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to save settings"));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      localStorage.removeItem(ACCESS_TOKEN_KEY);
      toast.success("Password changed. Please sign in again.");
      await logout?.().catch(() => {});
      navigate(user?.role === "admin" ? "/admin/login" : "/login", {
        replace: true,
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to change password"));
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm("Sign out of every device?")) {
      return;
    }

    try {
      await logoutAllDevices();
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      toast.success("Logged out from all devices");
      navigate(user?.role === "admin" ? "/admin/login" : "/login", {
        replace: true,
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to logout all devices"));
    }
  };

  const handleClearAi = async () => {
    if (!window.confirm("Delete all Campus AI conversation history?")) {
      return;
    }

    try {
      await clearAiHistoryFromSettings();
      toast.success("AI history cleared");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to clear AI history"));
    }
  };

  return (
    <DashboardLayout
      title="Settings"
      description="Account security, notifications, privacy and appearance"
    >
      {loading || !settings ? (
        <p className="text-sm text-[#b5bac1]">Loading settings...</p>
      ) : (
        <div className="mx-auto grid max-w-3xl gap-6">
          <section className="rounded-2xl border border-white/10 bg-[#2b2d31] p-5">
            <h2 className="text-lg font-bold text-white">Appearance</h2>
            <p className="mt-1 text-sm text-[#b5bac1]">
              Dark is the default CampusConnect theme.
            </p>

            <label className="mt-4 block text-sm">
              <span className="mb-1 block text-[#b5bac1]">Theme</span>
              <select
                value={settings.theme}
                disabled={saving}
                onChange={(event) =>
                  persistSettings({ theme: event.target.value })
                }
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-purple-400"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </label>

            <label className="mt-4 block text-sm">
              <span className="mb-1 block text-[#b5bac1]">
                Language (structure ready)
              </span>
              <select
                value={settings.language}
                disabled={saving}
                onChange={(event) =>
                  persistSettings({ language: event.target.value })
                }
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-purple-400"
              >
                <option value="en">English</option>
                <option value="hi">Hindi (future)</option>
              </select>
            </label>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#2b2d31] p-5">
            <h2 className="text-lg font-bold text-white">Notifications</h2>
            <div className="mt-4 space-y-2">
              {Object.entries(settings.notifications || {}).map(
                ([key, value]) => (
                  <Toggle
                    key={key}
                    label={key.replace(/([A-Z])/g, " $1")}
                    checked={Boolean(value)}
                    onChange={(checked) =>
                      persistSettings({
                        notifications: { [key]: checked },
                      })
                    }
                  />
                )
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#2b2d31] p-5">
            <h2 className="text-lg font-bold text-white">Privacy</h2>
            <div className="mt-4 space-y-2">
              {Object.entries(settings.privacy || {}).map(([key, value]) => (
                <Toggle
                  key={key}
                  label={key.replace(/([A-Z])/g, " $1")}
                  checked={Boolean(value)}
                  onChange={(checked) =>
                    persistSettings({
                      privacy: { [key]: checked },
                    })
                  }
                />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#2b2d31] p-5">
            <h2 className="text-lg font-bold text-white">Campus AI history</h2>
            <p className="mt-1 text-sm text-[#b5bac1]">
              Remove every AI conversation and message for your account.
            </p>
            <button
              type="button"
              onClick={handleClearAi}
              className="mt-4 rounded-xl border border-red-500/40 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/10"
            >
              Clear AI history
            </button>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#2b2d31] p-5">
            <h2 className="text-lg font-bold text-white">Change password</h2>
            <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
              <input
                type="password"
                required
                minLength={8}
                placeholder="Current password"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    currentPassword: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-purple-400"
              />
              <input
                type="password"
                required
                minLength={8}
                placeholder="New password"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    newPassword: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-purple-400"
              />
              <input
                type="password"
                required
                minLength={8}
                placeholder="Confirm new password"
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    confirmPassword: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-purple-400"
              />
              <button
                type="submit"
                className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-500"
              >
                Update password
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#2b2d31] p-5">
            <h2 className="text-lg font-bold text-white">Sessions</h2>
            <p className="mt-1 text-sm text-[#b5bac1]">
              Invalidate refresh sessions and revoke access tokens on every
              device.
            </p>
            <button
              type="button"
              onClick={handleLogoutAll}
              className="mt-4 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
            >
              Logout all devices
            </button>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
};

export default SettingsPage;
