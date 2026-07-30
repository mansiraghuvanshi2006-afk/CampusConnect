import { useEffect, useMemo, useState } from "react";

import toast from "react-hot-toast";
import { FiCamera, FiTrash2 } from "react-icons/fi";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import AvatarCropModal from "../../components/profile/AvatarCropModal.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import getErrorMessage from "../../utils/getErrorMessage.js";
import {
  deleteMyAvatar,
  getMyProfile,
  updateMyProfile,
  uploadMyAvatar,
} from "../../services/profileService.js";
import { getUploadAbsoluteUrl } from "../../services/chatService.js";

const STUDENT_FIELDS = [
  "name",
  "bio",
  "phone",
  "dob",
  "gender",
  "address",
  "socialLinks",
];
const TEACHER_FIELDS = [
  "name",
  "bio",
  "phone",
  "qualification",
  "experience",
  "specialization",
  "office",
  "socialLinks",
];
const ADMIN_FIELDS = ["name", "bio", "phone", "designation", "socialLinks"];

const emptySocial = {
  linkedin: "",
  github: "",
  twitter: "",
  website: "",
};

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cropFile, setCropFile] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const editable = useMemo(() => {
    if (user?.role === "teacher") {
      return new Set(TEACHER_FIELDS);
    }
    if (user?.role === "admin") {
      return new Set(ADMIN_FIELDS);
    }
    return new Set(STUDENT_FIELDS);
  }, [user?.role]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await getMyProfile();
        if (cancelled) {
          return;
        }
        setProfile(data);
        setForm({
          name: data.name || "",
          bio: data.bio || "",
          phone: data.phone || "",
          dob: data.dob ? String(data.dob).slice(0, 10) : "",
          gender: data.gender || "",
          address: data.address || "",
          qualification: data.qualification || "",
          experience: data.experience || "",
          specialization: data.specialization || "",
          office: data.office || "",
          designation: data.designation || "",
          socialLinks: { ...emptySocial, ...(data.socialLinks || {}) },
        });
      } catch (error) {
        toast.error(getErrorMessage(error, "Unable to load profile"));
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

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {};

      for (const key of editable) {
        if (key === "socialLinks") {
          payload.socialLinks = form.socialLinks;
          continue;
        }

        if (key === "dob") {
          payload.dob = form.dob || null;
          continue;
        }

        payload[key] = form[key];
      }

      const updated = await updateMyProfile(payload);
      setProfile(updated);
      updateUser?.({
        name: updated.name,
        avatarUrl: updated.avatarUrl,
        bio: updated.bio,
      });
      toast.success("Profile updated");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to update profile"));
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarConfirm = async (file) => {
    setUploadingAvatar(true);
    try {
      const updated = await uploadMyAvatar(file);
      setProfile(updated);
      updateUser?.({ avatarUrl: updated.avatarUrl });
      setCropFile(null);
      toast.success("Profile photo updated");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to upload photo"));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDeleteAvatar = async () => {
    try {
      const updated = await deleteMyAvatar();
      setProfile(updated);
      updateUser?.({ avatarUrl: null });
      toast.success("Profile photo removed");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to remove photo"));
    }
  };

  const avatarSrc = profile?.avatarUrl
    ? getUploadAbsoluteUrl(profile.avatarUrl)
    : null;

  return (
    <DashboardLayout
      title="My Profile"
      description="Update the details you control. Email, role and academic assignments stay admin-managed."
    >
      {loading ? (
        <p className="text-sm text-[#b5bac1]">Loading profile...</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <div className="rounded-2xl border border-white/10 bg-[#2b2d31] p-5">
            <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-purple-600/30 text-2xl font-bold text-purple-100">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={profile?.name || "Avatar"}
                  className="h-full w-full object-cover"
                />
              ) : (
                (profile?.name || "?").charAt(0).toUpperCase()
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-500">
                <FiCamera className="h-4 w-4" />
                Upload photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error("Photo must be 5MB or smaller");
                        return;
                      }
                      setCropFile(file);
                    }
                    event.target.value = "";
                  }}
                />
              </label>

              {profile?.avatarUrl && (
                <button
                  type="button"
                  onClick={handleDeleteAvatar}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-[#b5bac1] hover:bg-white/5"
                >
                  <FiTrash2 className="h-4 w-4" />
                  Remove photo
                </button>
              )}
            </div>

            <dl className="mt-6 space-y-3 text-sm">
              <div>
                <dt className="text-[#949ba4]">Email</dt>
                <dd className="truncate text-white">{profile?.email}</dd>
              </div>
              <div>
                <dt className="text-[#949ba4]">Role</dt>
                <dd className="capitalize text-white">{profile?.role}</dd>
              </div>
              <div>
                <dt className="text-[#949ba4]">Department</dt>
                <dd className="text-white">
                  {profile?.department?.name || "—"}
                </dd>
              </div>
              {profile?.role === "student" && (
                <div>
                  <dt className="text-[#949ba4]">Academic year</dt>
                  <dd className="text-white">{profile?.year ?? "—"}</dd>
                </div>
              )}
              {profile?.role === "teacher" && (
                <div>
                  <dt className="text-[#949ba4]">Teaching years</dt>
                  <dd className="text-white">
                    {(profile?.teachingYears || []).join(", ") || "—"}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <form
            onSubmit={handleSave}
            className="rounded-2xl border border-white/10 bg-[#2b2d31] p-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {editable.has("name") && (
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-[#b5bac1]">Name</span>
                  <input
                    value={form.name}
                    onChange={(event) => setField("name", event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-purple-400"
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </label>
              )}

              {editable.has("bio") && (
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-[#b5bac1]">Bio</span>
                  <textarea
                    value={form.bio}
                    onChange={(event) => setField("bio", event.target.value)}
                    rows={3}
                    maxLength={500}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-purple-400"
                  />
                </label>
              )}

              {editable.has("phone") && (
                <label className="block text-sm">
                  <span className="mb-1 block text-[#b5bac1]">Phone</span>
                  <input
                    value={form.phone}
                    onChange={(event) => setField("phone", event.target.value)}
                    maxLength={30}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-purple-400"
                  />
                </label>
              )}

              {editable.has("dob") && (
                <label className="block text-sm">
                  <span className="mb-1 block text-[#b5bac1]">Date of birth</span>
                  <input
                    type="date"
                    value={form.dob}
                    onChange={(event) => setField("dob", event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-purple-400"
                  />
                </label>
              )}

              {editable.has("gender") && (
                <label className="block text-sm">
                  <span className="mb-1 block text-[#b5bac1]">Gender</span>
                  <select
                    value={form.gender}
                    onChange={(event) => setField("gender", event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-purple-400"
                  >
                    <option value="">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </label>
              )}

              {editable.has("address") && (
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-[#b5bac1]">Address</span>
                  <input
                    value={form.address}
                    onChange={(event) =>
                      setField("address", event.target.value)
                    }
                    maxLength={300}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-purple-400"
                  />
                </label>
              )}

              {editable.has("qualification") && (
                <label className="block text-sm">
                  <span className="mb-1 block text-[#b5bac1]">
                    Qualification
                  </span>
                  <input
                    value={form.qualification}
                    onChange={(event) =>
                      setField("qualification", event.target.value)
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-purple-400"
                  />
                </label>
              )}

              {editable.has("experience") && (
                <label className="block text-sm">
                  <span className="mb-1 block text-[#b5bac1]">Experience</span>
                  <input
                    value={form.experience}
                    onChange={(event) =>
                      setField("experience", event.target.value)
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-purple-400"
                  />
                </label>
              )}

              {editable.has("specialization") && (
                <label className="block text-sm">
                  <span className="mb-1 block text-[#b5bac1]">
                    Specialization
                  </span>
                  <input
                    value={form.specialization}
                    onChange={(event) =>
                      setField("specialization", event.target.value)
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-purple-400"
                  />
                </label>
              )}

              {editable.has("office") && (
                <label className="block text-sm">
                  <span className="mb-1 block text-[#b5bac1]">Office</span>
                  <input
                    value={form.office}
                    onChange={(event) => setField("office", event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-purple-400"
                  />
                </label>
              )}

              {editable.has("designation") && (
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-[#b5bac1]">Designation</span>
                  <input
                    value={form.designation}
                    onChange={(event) =>
                      setField("designation", event.target.value)
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-purple-400"
                  />
                </label>
              )}
            </div>

            {editable.has("socialLinks") && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <p className="sm:col-span-2 text-sm font-semibold text-white">
                  Social links
                </p>
                {Object.keys(emptySocial).map((key) => (
                  <label key={key} className="block text-sm capitalize">
                    <span className="mb-1 block text-[#b5bac1]">{key}</span>
                    <input
                      value={form.socialLinks?.[key] || ""}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          socialLinks: {
                            ...prev.socialLinks,
                            [key]: event.target.value,
                          },
                        }))
                      }
                      placeholder="https://"
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-purple-400"
                    />
                  </label>
                ))}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save profile"}
              </button>
            </div>
          </form>
        </div>
      )}

      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          busy={uploadingAvatar}
          onCancel={() => setCropFile(null)}
          onConfirm={handleAvatarConfirm}
        />
      )}
    </DashboardLayout>
  );
};

export default ProfilePage;
