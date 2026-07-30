import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import toast from "react-hot-toast";

import {
  FiCamera,
  FiCheck,
  FiEdit2,
  FiLoader,
  FiLogOut,
  FiSearch,
  FiShield,
  FiStar,
  FiTrash2,
  FiUserMinus,
  FiUserPlus,
  FiUsers,
  FiX,
} from "react-icons/fi";

import {
  addConversationMembers,
  demoteGroupMember,
  getGroupMemberOptions,
  getGroupMembers,
  getUploadAbsoluteUrl,
  promoteGroupMember,
  removeConversationMember,
  transferGroupOwnership,
  updateConversation,
  uploadGroupImage,
} from "../../services/chatService.js";

import getErrorMessage from "../../utils/getErrorMessage.js";
import { getInitials } from "../../utils/chatHelpers.js";

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const formatDate = (value) => {
  if (!value) {
    return "Unknown";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const GroupDetailsPanel = ({
  conversation,
  currentUserId,
  onClose,
  onConversationUpdated,
  onLeaveGroup,
  onDeleteGroup,
}) => {
  const conversationId = conversation?.id;
  const permissions = conversation?.permissions || {};

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(
    conversation?.name || ""
  );
  const [editDescription, setEditDescription] = useState(
    conversation?.description || ""
  );
  const [savingDetails, setSavingDetails] =
    useState(false);
  const [uploadingImage, setUploadingImage] =
    useState(false);

  const [showAddMembers, setShowAddMembers] =
    useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] =
    useState("");
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] =
    useState(false);
  const [selectedCandidateIds, setSelectedCandidateIds] =
    useState([]);
  const [addingMembers, setAddingMembers] =
    useState(false);

  const [busyMemberId, setBusyMemberId] = useState(null);

  const fileInputRef = useRef(null);

  /*
    The panel merges its own fetch with the live conversation from
    the chat page so realtime updates stay visible.
  */
  const group = useMemo(
    () => ({
      ...(details || {}),
      ...(conversation || {}),
    }),
    [details, conversation]
  );

  const members = useMemo(
    () => group.members || [],
    [group.members]
  );

  const ownerId = group?.owner || null;

  const sortedMembers = useMemo(() => {
    const rank = (member) => {
      if (member.id === ownerId) {
        return 0;
      }

      return member.role === "admin" ? 1 : 2;
    };

    return [...members].sort((first, second) => {
      const difference = rank(first) - rank(second);

      if (difference !== 0) {
        return difference;
      }

      return (first.name || "").localeCompare(
        second.name || ""
      );
    });
  }, [members, ownerId]);

  const applyGroup = (nextGroup) => {
    if (!nextGroup) {
      return;
    }

    setDetails(nextGroup);
    onConversationUpdated?.(nextGroup);
  };

  useEffect(() => {
    if (!conversationId) {
      return undefined;
    }

    let cancelled = false;

    const loadDetails = async () => {
      setLoading(true);

      try {
        const result =
          await getGroupMembers(conversationId);

        if (cancelled) {
          return;
        }

        setDetails(result.group || null);
        setEditName(result.group?.name || "");
        setEditDescription(
          result.group?.description || ""
        );
      } catch (error) {
        if (!cancelled) {
          toast.error(
            getErrorMessage(
              error,
              "Unable to load group details"
            )
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDetails();

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(memberSearch.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [memberSearch]);

  useEffect(() => {
    if (!showAddMembers || !conversationId) {
      return undefined;
    }

    let cancelled = false;

    const loadCandidates = async () => {
      setLoadingCandidates(true);

      try {
        const result = await getGroupMemberOptions({
          conversationId,
          ...(debouncedSearch
            ? { search: debouncedSearch }
            : {}),
          limit: 20,
        });

        if (!cancelled) {
          setCandidates(result.users || []);
        }
      } catch (error) {
        if (!cancelled) {
          setCandidates([]);

          toast.error(
            getErrorMessage(
              error,
              "Unable to load eligible members"
            )
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingCandidates(false);
        }
      }
    };

    void loadCandidates();

    return () => {
      cancelled = true;
    };
  }, [showAddMembers, conversationId, debouncedSearch]);

  const handleSaveDetails = async (event) => {
    event.preventDefault();

    if (editName.trim().length < 2) {
      toast.error(
        "Group name must contain at least 2 characters"
      );

      return;
    }

    setSavingDetails(true);

    try {
      const updated = await updateConversation(
        conversationId,
        {
          name: editName.trim(),
          description: editDescription.trim() || null,
        }
      );

      applyGroup(updated);
      setIsEditing(false);
      toast.success("Group updated");
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Unable to update the group"
        )
      );
    } finally {
      setSavingDetails(false);
    }
  };

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Group image must be an image file");

      return;
    }

    if (file.size > IMAGE_MAX_BYTES) {
      toast.error("Group image cannot exceed 5 MB");

      return;
    }

    setUploadingImage(true);

    try {
      const uploadedUrl = await uploadGroupImage(file);

      const updated = await updateConversation(
        conversationId,
        { image: uploadedUrl }
      );

      applyGroup(updated);
      toast.success("Group image updated");
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Unable to update the group image"
        )
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const toggleCandidate = (userId) => {
    setSelectedCandidateIds((previous) =>
      previous.includes(userId)
        ? previous.filter((id) => id !== userId)
        : [...previous, userId]
    );
  };

  const handleAddMembers = async () => {
    if (selectedCandidateIds.length === 0) {
      return;
    }

    setAddingMembers(true);

    try {
      const result = await addConversationMembers(
        conversationId,
        selectedCandidateIds
      );

      applyGroup(result?.conversation);
      setSelectedCandidateIds([]);
      setShowAddMembers(false);
      setMemberSearch("");
      toast.success("Members added");
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Unable to add members"
        )
      );
    } finally {
      setAddingMembers(false);
    }
  };

  const runMemberAction = async (
    userId,
    action,
    successMessage,
    fallbackError
  ) => {
    setBusyMemberId(userId);

    try {
      const result = await action();

      applyGroup(result?.group || result?.conversation);
      toast.success(successMessage);
    } catch (error) {
      toast.error(
        getErrorMessage(error, fallbackError)
      );
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleRemoveMember = (member) =>
    runMemberAction(
      member.id,
      () =>
        removeConversationMember(
          conversationId,
          member.id
        ),
      `${member.name} was removed`,
      "Unable to remove the member"
    );

  const handlePromote = (member) =>
    runMemberAction(
      member.id,
      () => promoteGroupMember(conversationId, member.id),
      `${member.name} is now a group admin`,
      "Unable to promote the member"
    );

  const handleDemote = (member) =>
    runMemberAction(
      member.id,
      () => demoteGroupMember(conversationId, member.id),
      `${member.name} is no longer a group admin`,
      "Unable to demote the admin"
    );

  const handleTransferOwnership = (member) =>
    runMemberAction(
      member.id,
      () =>
        transferGroupOwnership(
          conversationId,
          member.id
        ),
      `${member.name} is now the group owner`,
      "Unable to transfer ownership"
    );

  const groupImage = group?.image
    ? getUploadAbsoluteUrl(group.image)
    : "";

  return (
    <aside className="flex h-full w-full min-w-0 flex-col border-l border-white/10 bg-[#2b2d31]">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <FiUsers className="h-4 w-4 text-purple-300" />
          Group info
        </h3>

        <button
          type="button"
          aria-label="Close group info"
          onClick={onClose}
          className="rounded-xl p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
        >
          <FiX className="h-5 w-5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col items-center gap-3 border-b border-white/10 px-4 py-5 text-center">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-purple-600/30 text-xl font-bold text-purple-100">
              {groupImage ? (
                <img
                  src={groupImage}
                  alt={group?.name || "Group"}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(group?.name || "Group")
              )}
            </div>

            {permissions.canEditGroup && (
              <button
                type="button"
                aria-label="Change group image"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                disabled={uploadingImage}
                className="absolute bottom-0 right-0 rounded-full border border-white/10 bg-[#1e1f22] p-2 text-[#b5bac1] transition hover:text-white disabled:opacity-60"
              >
                {uploadingImage ? (
                  <FiLoader className="h-4 w-4 animate-spin" />
                ) : (
                  <FiCamera className="h-4 w-4" />
                )}
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>

          {isEditing ? (
            <form
              onSubmit={handleSaveDetails}
              className="w-full space-y-3 text-left"
            >
              <input
                value={editName}
                onChange={(event) =>
                  setEditName(event.target.value)
                }
                maxLength={120}
                placeholder="Group name"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-purple-400"
              />

              <textarea
                value={editDescription}
                onChange={(event) =>
                  setEditDescription(event.target.value)
                }
                maxLength={500}
                rows={3}
                placeholder="Description"
                className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-purple-400"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditName(group?.name || "");
                    setEditDescription(
                      group?.description || ""
                    );
                  }}
                  disabled={savingDetails}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-[#b5bac1] transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingDetails}
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-purple-500 disabled:opacity-50"
                >
                  {savingDetails && (
                    <FiLoader className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Save
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="min-w-0">
                <h4 className="break-words text-lg font-bold text-white">
                  {group?.name || "Group"}
                </h4>

                <p className="mt-1 break-words text-sm text-[#b5bac1]">
                  {group?.description ||
                    "No description"}
                </p>
              </div>

              {permissions.canEditGroup && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
                >
                  <FiEdit2 className="h-3.5 w-3.5" />
                  Edit group
                </button>
              )}
            </>
          )}
        </div>

        <dl className="divide-y divide-white/5 border-b border-white/10">
          {[
            {
              label: "Department",
              value:
                group?.department?.name ||
                "All departments",
            },
            {
              label: "Academic years",
              value:
                group?.academicYears?.length > 0
                  ? group.academicYears
                      .map((year) => `Year ${year}`)
                      .join(", ")
                  : "All years",
            },
            {
              label: "Owner",
              value:
                group?.ownerDetails?.name || "Unknown",
            },
            {
              label: "Created by",
              value: group?.creator?.name || "Unknown",
            },
            {
              label: "Created",
              value: formatDate(group?.createdAt),
            },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-start justify-between gap-3 px-4 py-3"
            >
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#949ba4]">
                {row.label}
              </dt>

              <dd className="min-w-0 break-words text-right text-sm text-white">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="px-4 py-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">
              {group?.memberCount ?? members.length}{" "}
              members
            </p>

            {permissions.canAddMembers && (
              <button
                type="button"
                onClick={() =>
                  setShowAddMembers(
                    (previous) => !previous
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
              >
                <FiUserPlus className="h-3.5 w-3.5" />
                {showAddMembers ? "Close" : "Add"}
              </button>
            )}
          </div>

          {showAddMembers && (
            <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-3">
              <label className="relative block">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#949ba4]" />

                <input
                  type="search"
                  value={memberSearch}
                  onChange={(event) =>
                    setMemberSearch(event.target.value)
                  }
                  placeholder="Search eligible users"
                  className="w-full rounded-xl border border-white/10 bg-black/30 py-2 pl-10 pr-3 text-sm text-white outline-none focus:border-purple-400"
                />
              </label>

              <div className="mt-3 max-h-56 overflow-y-auto">
                {loadingCandidates && (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#b5bac1]">
                    <FiLoader className="h-4 w-4 animate-spin" />
                    Loading...
                  </div>
                )}

                {!loadingCandidates &&
                  candidates.length === 0 && (
                    <p className="py-6 text-center text-xs text-[#b5bac1]">
                      No eligible users found
                    </p>
                  )}

                {!loadingCandidates &&
                  candidates.map((candidate) => {
                    const selected =
                      selectedCandidateIds.includes(
                        candidate.id
                      );

                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() =>
                          toggleCandidate(candidate.id)
                        }
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/5"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-600/30 text-[11px] font-bold text-purple-100">
                          {getInitials(candidate.name)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-white">
                            {candidate.name}
                          </p>

                          <p className="truncate text-xs text-[#b5bac1]">
                            {candidate.role === "teacher"
                              ? "Teacher"
                              : `Year ${candidate.year ?? "-"}`}
                          </p>
                        </div>

                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            selected
                              ? "border-purple-400 bg-purple-600 text-white"
                              : "border-white/20 text-transparent"
                          }`}
                        >
                          <FiCheck className="h-3 w-3" />
                        </span>
                      </button>
                    );
                  })}
              </div>

              <button
                type="button"
                onClick={handleAddMembers}
                disabled={
                  addingMembers ||
                  selectedCandidateIds.length === 0
                }
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-purple-500 disabled:opacity-50"
              >
                {addingMembers && (
                  <FiLoader className="h-3.5 w-3.5 animate-spin" />
                )}
                Add{" "}
                {selectedCandidateIds.length > 0
                  ? selectedCandidateIds.length
                  : ""}{" "}
                {selectedCandidateIds.length === 1
                  ? "member"
                  : "members"}
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#b5bac1]">
              <FiLoader className="h-4 w-4 animate-spin" />
              Loading members...
            </div>
          )}

          <ul className="space-y-1">
            {sortedMembers.map((member) => {
              const isOwner = member.id === ownerId;
              const isGroupAdmin =
                member.role === "admin";
              const isSelf = member.id === currentUserId;
              const isBusy = busyMemberId === member.id;

              const platformRole =
                member.userRole || member.role;

              const canPromote =
                permissions.canPromoteMembers &&
                !isGroupAdmin &&
                platformRole !== "student";

              const canDemote =
                permissions.canDemoteAdmins &&
                isGroupAdmin &&
                !isOwner;

              const canRemove =
                permissions.canRemoveMembers &&
                !isOwner &&
                !isSelf;

              const canTransfer =
                permissions.canTransferOwnership &&
                !isOwner &&
                platformRole !== "student";

              return (
                <li
                  key={member.id}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/5"
                >
                  <div className="relative shrink-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-600/30 text-xs font-bold text-purple-100">
                      {getInitials(member.name)}
                    </div>

                    {member.isOnline && (
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#2b2d31] bg-emerald-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
                      <span className="truncate">
                        {isSelf ? "You" : member.name}
                      </span>

                      {isOwner && (
                        <FiStar
                          title="Owner"
                          className="h-3 w-3 shrink-0 text-amber-300"
                        />
                      )}

                      {!isOwner && isGroupAdmin && (
                        <FiShield
                          title="Group admin"
                          className="h-3 w-3 shrink-0 text-purple-300"
                        />
                      )}
                    </p>

                    <p className="truncate text-xs text-[#b5bac1]">
                      {isOwner
                        ? "Owner"
                        : isGroupAdmin
                          ? "Group admin"
                          : "Member"}
                      {platformRole === "teacher"
                        ? " · Teacher"
                        : member.year
                          ? ` · Year ${member.year}`
                          : ""}
                    </p>
                  </div>

                  {isBusy ? (
                    <FiLoader className="h-4 w-4 shrink-0 animate-spin text-[#b5bac1]" />
                  ) : (
                    <div className="flex shrink-0 items-center gap-1">
                      {canPromote && (
                        <button
                          type="button"
                          title="Promote to group admin"
                          onClick={() =>
                            handlePromote(member)
                          }
                          className="rounded-lg p-1.5 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
                        >
                          <FiShield className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {canDemote && (
                        <button
                          type="button"
                          title="Remove group admin role"
                          onClick={() =>
                            handleDemote(member)
                          }
                          className="rounded-lg p-1.5 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
                        >
                          <FiUserMinus className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {canTransfer && (
                        <button
                          type="button"
                          title="Transfer ownership"
                          onClick={() =>
                            handleTransferOwnership(
                              member
                            )
                          }
                          className="rounded-lg p-1.5 text-[#b5bac1] transition hover:bg-white/10 hover:text-amber-200"
                        >
                          <FiStar className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {canRemove && (
                        <button
                          type="button"
                          title="Remove from group"
                          onClick={() =>
                            handleRemoveMember(member)
                          }
                          className="rounded-lg p-1.5 text-red-300 transition hover:bg-white/10 hover:text-red-200"
                        >
                          <FiTrash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-2 border-t border-white/10 px-4 py-4">
          {permissions.canLeave && (
            <button
              type="button"
              onClick={onLeaveGroup}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-semibold text-[#dbdee1] transition hover:bg-white/10"
            >
              <FiLogOut className="h-4 w-4" />
              Leave group
            </button>
          )}

          {permissions.canDeleteGroup && (
            <button
              type="button"
              onClick={onDeleteGroup}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600/90 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600"
            >
              <FiTrash2 className="h-4 w-4" />
              Delete group
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default GroupDetailsPanel;
