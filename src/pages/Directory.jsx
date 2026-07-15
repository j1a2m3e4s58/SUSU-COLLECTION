import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ConfirmActionDialog from "@/components/ui/confirm-action-dialog";
import ControlledSelect from "@/components/ui/controlled-select";
import {
  archiveStaff,
  createAgentAccount,
  deleteStaff,
  getActiveStaff,
  getPortalSettings,
  resolveAssetUrl,
  updateStaff,
} from "@/api/portalClient";
import { useAuth } from "@/lib/AuthContext";
import { Archive, Building2, Loader2, Mail, MapPin, Phone, Search, ShieldCheck, Trash2, UserPlus, UserX, Users } from "lucide-react";

function initials(name) {
  return String(name || "User")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatLastSeen(value) {
  if (!value) return "Not seen yet";
  return new Date(Number(value)).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function directoryDepartmentGroup(department) {
  const normalized = String(department || "Other").trim().toUpperCase();
  if (normalized === "SUSU") return "SUSU";
  if (normalized === "SUSU AGENT") return "SUSU AGENTS";
  return normalized || "Other";
}

function EditStaffDialog({ staff, branches, departments, open, onOpenChange, onSaved }) {
  const [position, setPosition] = useState("");
  const [branch, setBranch] = useState("");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!staff) return;
    setPosition(staff.position || "");
    setBranch(staff.branch || "HEAD OFFICE");
    setDepartment(staff.department || "SUSU AGENT");
    setError("");
  }, [staff]);

  const handleSave = async () => {
    if (!staff) return;
    setSaving(true);
    setError("");
    try {
      const updated = await updateStaff(staff.id, {
        position,
        branch,
        department,
      });
      onSaved(updated);
      onOpenChange(false);
    } catch (err) {
      setError(err.message || "Could not update staff details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-xl p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle>Update Staff Details</DialogTitle>
          <DialogDescription>
            Update position, branch, or SUSU category for {staff?.fullname}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-position">Position / Job Title</Label>
            <Input
              id="edit-position"
              value={position}
              onChange={(event) => setPosition(event.target.value)}
              placeholder="e.g. Teller, Loan Officer"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-branch">Branch</Label>
            <ControlledSelect
              value={branch}
              onChange={setBranch}
              options={branches}
              placeholder="Select branch"
              className="h-10 rounded-lg border-border bg-background text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-department">SUSU Category</Label>
            <ControlledSelect
              value={department}
              onChange={setDepartment}
              options={departments}
              placeholder="Select SUSU category"
              className="h-10 rounded-lg border-border bg-background text-sm"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Directory() {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editTarget, setEditTarget] = useState(null);
  const [archivingId, setArchivingId] = useState("");
  const [removingId, setRemovingId] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [addingAgent, setAddingAgent] = useState(false);
  const [agentForm, setAgentForm] = useState({
    fullname: "",
    username: "",
    temporaryPassword: "",
    phone: "",
    branch: "",
  });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [settings, users] = await Promise.all([getPortalSettings(), getActiveStaff()]);
        if (!mounted) return;
        setBranches(settings.branches || []);
        setDepartments(["SUSU", "SUSU AGENT"]);
        setStaff((users || []).filter((member) => member.role !== "OwnerAdmin"));
        setError("");
      } catch (err) {
        if (mounted) setError(err.message || "Could not load staff directory");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    const intervalId = window.setInterval(load, 5000);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((member) => {
      if (member.role === "OwnerAdmin") return false;
      const matchesBranch = branch === "ALL" || member.branch === branch;
      const haystack = [
        member.fullname,
        member.email,
        member.phone,
        member.department,
        member.branch,
        member.position,
        member.role,
      ]
        .join(" ")
        .toLowerCase();
      return matchesBranch && (!q || haystack.includes(q));
    });
  }, [staff, search, branch]);

  const scopedStaff = staff;
  const onlineCount = scopedStaff.filter((member) => member.isOnlineNow).length;
  const canOwnerControl = user?.role === "OwnerAdmin";
  const managedBranches = Array.isArray(user?.managedBranches) && user.managedBranches.length
    ? user.managedBranches
    : [user?.branch].filter(Boolean);
  const scopedBranchOptions = branches.filter((item) => managedBranches.includes(item));
  const addAgentBranches = canOwnerControl ? branches : (scopedBranchOptions.length ? scopedBranchOptions : managedBranches);
  const canAddAgentUser = canOwnerControl || (user?.role === "Supervisor" && addAgentBranches.length > 0);
  const canManageMember = (member) => {
    if (!member || member.id === user?.id || ["OwnerAdmin", "SuperAdmin"].includes(member.role)) return false;
    if (canOwnerControl) return true;
    const memberBranch = member.branch || member.branch_name;
    return (
      user?.role === "Supervisor" &&
      String(member.department || "").trim().toUpperCase() === "SUSU AGENT" &&
      managedBranches.includes(memberBranch)
    );
  };
  const branchOnline = branches.map((item) => ({
    branch: item,
    total: scopedStaff.filter((member) => member.branch === item).length,
    online: scopedStaff.filter((member) => member.branch === item && member.isOnlineNow).length,
  }));
  const departmentGroups = useMemo(() => {
    const groups = new Map();
    filtered.forEach((member) => {
      const department = directoryDepartmentGroup(member.department);
      if (!groups.has(department)) groups.set(department, []);
      groups.get(department).push(member);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const handleSavedStaff = (updated) => {
    setStaff((current) => current.map((member) => (member.id === updated.id ? updated : member)));
    setSuccess(`${updated.fullname} has been updated.`);
    setError("");
  };

  const handleArchiveStaff = async (member) => {
    setArchivingId(member.id);
    setError("");
    setSuccess("");
    try {
      await archiveStaff(member.id);
      setStaff((current) => current.filter((item) => item.id !== member.id));
      setSuccess(`${member.fullname} has been moved to Past Staff records.`);
    } catch (err) {
      setError(err.message || "Could not archive this user");
    } finally {
      setArchivingId("");
      setConfirmAction(null);
    }
  };

  const handleRemoveStaff = async (member) => {
    setRemovingId(member.id);
    setError("");
    setSuccess("");
    try {
      await deleteStaff(member.id);
      setStaff((current) => current.filter((item) => item.id !== member.id));
      setSuccess(`${member.fullname} has been removed from the system.`);
    } catch (err) {
      setError(err.message || "Could not remove this user");
    } finally {
      setRemovingId("");
      setConfirmAction(null);
    }
  };

  const handleAddAgent = async () => {
    if (!agentForm.username || !agentForm.temporaryPassword || !agentForm.phone || !agentForm.branch) {
      setError("Enter username, temporary password, phone, and branch.");
      return;
    }
    setAddingAgent(true);
    setError("");
    setSuccess("");
    try {
      const created = await createAgentAccount(agentForm);
      setStaff((current) => [created, ...current.filter((member) => member.id !== created.id)]);
      setSuccess(`${created.fullname || created.loginUsername || "Agent"} has been added.`);
      setShowAddAgent(false);
      setAgentForm({
        fullname: "",
        username: "",
        temporaryPassword: "",
        phone: "",
        branch: addAgentBranches[0] || "",
      });
    } catch (err) {
      setError(err.message || "Could not add this agent.");
    } finally {
      setAddingAgent(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">
            People and presence
          </p>
          <h1 className="mt-1 flex items-center gap-2 font-heading text-2xl font-bold text-foreground lg:text-3xl">
            <Users className="h-7 w-7 text-blue-500" />
            Staff Directory
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            See active staff, branch coverage, and who is online now.
          </p>
        </div>
        {(canOwnerControl || canAddAgentUser) && (
          <div className="flex flex-wrap gap-2">
            {canOwnerControl && (
              <Link to="/past-staff">
                <Button variant="outline" className="gap-2">
                  <UserX className="h-4 w-4" />
                  Past Staff
                </Button>
              </Link>
            )}
            {canOwnerControl && (
              <Link to="/supervisor-management">
                <Button className="gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Supervisor Management
                </Button>
              </Link>
            )}
            {canAddAgentUser && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setAgentForm((current) => ({ ...current, branch: current.branch || addAgentBranches[0] || "" }));
                  setError("");
                  setShowAddAgent(true);
                }}
              >
                <UserPlus className="h-4 w-4" />
                Add User
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Active Staff</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{scopedStaff.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Online Now</p>
          <p className="mt-1 text-2xl font-bold text-emerald-500">{onlineCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Branches</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{branches.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Offline</p>
          <p className="mt-1 text-2xl font-bold text-destructive">{Math.max(scopedStaff.length - onlineCount, 0)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {branchOnline.map((item) => (
            <button
              key={item.branch}
              type="button"
              onClick={() => setBranch(item.branch)}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                branch === item.branch
                  ? "border-blue-500 bg-blue-500/10 text-blue-600"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <span className="font-semibold">{item.branch}</span>
              <span className="ml-2 text-emerald-500">{item.online} online</span>
              <span className="ml-1">/ {item.total}</span>
            </button>
          ))}
          {branch !== "ALL" && (
            <button
              type="button"
              onClick={() => setBranch("ALL")}
              className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
            >
              Clear branch
            </button>
          )}
        </div>
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, phone, email, SUSU category, branch..."
            className="pl-10"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-600">
          {success}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-52 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : departmentGroups.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No staff match your search.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {departmentGroups.map(([department, members]) => (
            <section key={department}>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-foreground">
                    {department}
                  </h2>
                  <Badge variant="secondary" className="tabular-nums">
                    {members.length}
                  </Badge>
                  <span className="text-xs text-emerald-500">
                    {members.filter((member) => member.isOnlineNow).length} online
                  </span>
                </div>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {members.map((member) => {
                  const photo = resolveAssetUrl(member.imageFile);
                  const canEdit = canManageMember(member);
                  const canArchive = canOwnerControl && canEdit;
                  const canRemove = canEdit;
                  return (
                    <div key={member.id} className="flex h-[198px] flex-col gap-2 overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm transition-transform hover:-translate-y-0.5 sm:h-[238px] sm:gap-3 sm:p-4">
                      <div className="flex items-start gap-3">
                        <div className="relative h-11 w-11 shrink-0 sm:h-12 sm:w-12">
                          <div className="h-11 w-11 overflow-hidden rounded-full bg-blue-500/10 text-blue-600 sm:h-12 sm:w-12">
                            {photo ? (
                              <img src={photo} alt={member.fullname} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm font-bold">
                                {initials(member.fullname)}
                              </div>
                            )}
                          </div>
                          {member.isOnlineNow && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 animate-ping rounded-full bg-emerald-500/50" />
                          )}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 z-10 h-3.5 w-3.5 rounded-full border-2 border-card shadow-sm ${
                              member.isOnlineNow ? "bg-emerald-500" : "bg-destructive"
                            }`}
                            title={member.isOnlineNow ? "Online" : "Offline"}
                          >
                            <span className="sr-only">
                              {member.isOnlineNow ? "Online" : "Offline"}
                            </span>
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <h3 className="truncate text-sm font-semibold text-foreground">{member.fullname}</h3>
                            {member.isVerified && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{member.position || member.role}</p>
                          <p className={`mt-1 truncate text-xs font-semibold ${member.isOnlineNow ? "text-emerald-500" : "text-destructive"}`}>
                            {member.isOnlineNow ? "Online Now" : `Offline - ${formatLastSeen(member.lastSeen)}`}
                          </p>
                        </div>
                        <Badge variant={member.role === "GeneralStaff" ? "outline" : "secondary"} className="max-w-[96px] shrink-0 truncate px-2 text-[10px] sm:max-w-none sm:text-xs">
                          {member.role}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <p className="flex min-w-0 items-center gap-1 truncate">
                          <Building2 className="h-3 w-3 shrink-0 text-blue-500" />
                          <span className="truncate">{member.department}</span>
                        </p>
                        <p className="flex min-w-0 items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0 text-amber-500" />
                          <span className="truncate">{member.branch}</span>
                        </p>
                      </div>

                      <div className="mt-auto space-y-1 border-t border-border pt-2 text-xs text-muted-foreground sm:space-y-1.5 sm:pt-3">
                        <a href={`mailto:${member.email}`} className="flex min-w-0 items-center gap-2 hover:text-blue-500">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 truncate">{member.email}</span>
                        </a>
                        <a href={`tel:${member.phone}`} className="flex min-w-0 items-center gap-2 hover:text-blue-500">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 truncate">{member.phone}</span>
                        </a>
                      </div>

                      {canEdit && (
                        <div className={`grid h-8 shrink-0 gap-2 border-t border-border pt-1 sm:h-9 ${
                          canArchive && canRemove ? "grid-cols-3" : canRemove ? "grid-cols-2" : "grid-cols-1"
                        }`}>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setEditTarget(member)}
                          >
                            Edit
                          </Button>
                          {canArchive && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={archivingId === member.id}
                              onClick={() => setConfirmAction({ type: "archive", member })}
                            >
                              <Archive className="mr-1 h-3.5 w-3.5" />
                              {archivingId === member.id ? "Archiving..." : "Archive"}
                            </Button>
                          )}
                          {canRemove && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={removingId === member.id}
                              onClick={() => setConfirmAction({ type: "remove", member })}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              {removingId === member.id ? "Removing..." : "Remove"}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <EditStaffDialog
        staff={editTarget}
        branches={branches}
        departments={departments}
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        onSaved={handleSavedStaff}
      />

      <Dialog open={showAddAgent} onOpenChange={setShowAddAgent}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle>Add Agent User</DialogTitle>
            <DialogDescription>
              Create a username and temporary password for a SUSU agent.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="agent-fullname">Full Name</Label>
              <Input
                id="agent-fullname"
                value={agentForm.fullname}
                onChange={(event) => setAgentForm({ ...agentForm, fullname: event.target.value })}
                placeholder="e.g. Gabriel Owusu"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="agent-username">Username</Label>
                <Input
                  id="agent-username"
                  value={agentForm.username}
                  onChange={(event) => setAgentForm({ ...agentForm, username: event.target.value })}
                  placeholder="e.g. gabriel01"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agent-phone">Phone</Label>
                <Input
                  id="agent-phone"
                  value={agentForm.phone}
                  onChange={(event) => setAgentForm({ ...agentForm, phone: event.target.value })}
                  placeholder="024..."
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agent-temp-password">Temporary Password</Label>
              <Input
                id="agent-temp-password"
                value={agentForm.temporaryPassword}
                onChange={(event) => setAgentForm({ ...agentForm, temporaryPassword: event.target.value })}
                placeholder="Temporary password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agent-branch">Branch</Label>
              <ControlledSelect
                value={agentForm.branch}
                onChange={(value) => setAgentForm({ ...agentForm, branch: value })}
                options={addAgentBranches}
                placeholder="Select branch"
                className="h-10 rounded-lg border-border bg-background text-sm"
              />
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-xs text-muted-foreground">
              First login will ask for this phone number, then generate a one-time setup token before a permanent password.
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowAddAgent(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddAgent} disabled={addingAgent}>
              {addingAgent ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add User"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title={confirmAction?.type === "archive" ? "Archive staff member?" : "Remove staff member?"}
        description={
          confirmAction?.type === "archive"
            ? `Archive ${confirmAction?.member?.fullname || "this staff member"} and move them out of the active directory.`
            : `Permanently remove ${confirmAction?.member?.fullname || "this staff member"} from the system. Their login will be cleared so they can sign up again.`
        }
        confirmLabel={confirmAction?.type === "archive" ? "Archive" : "Remove"}
        destructive
        busy={Boolean(archivingId || removingId)}
        onConfirm={() => {
          if (!confirmAction?.member) return;
          if (confirmAction.type === "archive") handleArchiveStaff(confirmAction.member);
          else handleRemoveStaff(confirmAction.member);
        }}
      />
    </div>
  );
}
