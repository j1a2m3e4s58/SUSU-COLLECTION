import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import ControlledSelect from "@/components/ui/controlled-select";
import { Input } from "@/components/ui/input";
import { getActiveStaff, getPortalSettings, updateStaff } from "@/api/portalClient";
import {
  ArrowLeft,
  ArrowRightLeft,
  Check,
  Search,
  ShieldCheck,
  UserX,
} from "lucide-react";

const DEFAULT_PERMISSIONS = {
  customers: true,
  transactions: true,
  reports: true,
  agents: true,
  branches: true,
  auditLog: false,
  backupExport: true,
  userManagement: false,
};

export default function SupervisorManagement() {
  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("GeneralStaff");
  const [managedBranches, setManagedBranches] = useState([]);
  const [transferTo, setTransferTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [settings, users] = await Promise.all([getPortalSettings(), getActiveStaff()]);
        if (!mounted) return;
        setBranches(settings.branches || []);
        const visibleUsers = (users || []).filter((member) => member.role !== "OwnerAdmin");
        setStaff(visibleUsers);
        setSelectedId((current) => current || visibleUsers[0]?.id || "");
      } catch (err) {
        if (mounted) setError(err.message || "Could not load supervisor data");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const selected = useMemo(
    () => staff.find((member) => member.id === selectedId) || null,
    [staff, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    setRole(selected.role === "Supervisor" ? "Supervisor" : "GeneralStaff");
    setManagedBranches(selected.managedBranches || []);
    setTransferTo("");
    setError("");
  }, [selected]);

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((member) =>
      [member.fullname, member.email, member.branch, member.department, member.role]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [staff, search]);

  function flash(text) {
    setMessage(text);
    setTimeout(() => setMessage(""), 2500);
  }

  function syncUpdated(updated) {
    setStaff((current) => current.map((member) => (member.id === updated.id ? updated : member)));
    setSelectedId(updated.id);
  }

  function toggleBranch(branch, checked) {
    const key = branch.toUpperCase();
    setManagedBranches((current) =>
      checked ? Array.from(new Set([...current, key])) : current.filter((item) => item !== key),
    );
  }

  function validateSupervisor() {
    if (role !== "Supervisor") return true;
    if (managedBranches.length === 0) {
      setError("Assign at least one branch before saving a supervisor.");
      return false;
    }
    return true;
  }

  async function saveSupervisor() {
    if (!selected || !validateSupervisor()) return;
    setSaving(true);
    setError("");
    try {
      const nextRole = role === "Supervisor" ? "Supervisor" : "GeneralStaff";
      const updated = await updateStaff(selected.id, {
        role: nextRole,
        managedBranches: nextRole === "Supervisor" ? managedBranches : [],
        managedDepartmentsByBranch: {},
        permissions: DEFAULT_PERMISSIONS,
      });
      syncUpdated(updated);
      flash("Supervisor access saved");
    } catch (err) {
      setError(err.message || "Could not save supervisor access");
    } finally {
      setSaving(false);
    }
  }

  async function removeSupervisor() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const updated = await updateStaff(selected.id, {
        role: "GeneralStaff",
        managedBranches: [],
        managedDepartmentsByBranch: {},
        permissions: DEFAULT_PERMISSIONS,
      });
      syncUpdated(updated);
      setRole("GeneralStaff");
      setManagedBranches([]);
      flash("Supervisor access removed");
    } catch (err) {
      setError(err.message || "Could not remove supervisor access");
    } finally {
      setSaving(false);
    }
  }

  async function transferSupervisor() {
    if (!selected || !transferTo || role !== "Supervisor" || !validateSupervisor()) return;
    const target = staff.find((member) => member.id === transferTo);
    if (!target) return;
    setSaving(true);
    setError("");
    try {
      const updatedTarget = await updateStaff(target.id, {
        role: "Supervisor",
        managedBranches,
        managedDepartmentsByBranch: {},
        permissions: DEFAULT_PERMISSIONS,
      });
      const updatedSource = await updateStaff(selected.id, {
        role: "GeneralStaff",
        managedBranches: [],
        managedDepartmentsByBranch: {},
        permissions: DEFAULT_PERMISSIONS,
      });
      setStaff((current) =>
        current.map((member) => {
          if (member.id === updatedTarget.id) return updatedTarget;
          if (member.id === updatedSource.id) return updatedSource;
          return member;
        }),
      );
      setSelectedId(updatedTarget.id);
      flash(`Transferred supervisor access to ${updatedTarget.fullname}`);
    } catch (err) {
      setError(err.message || "Could not transfer supervisor access");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">
            Access and delegation
          </p>
          <h1 className="mt-1 flex items-center gap-2 font-heading text-2xl font-bold text-foreground lg:text-3xl">
            <ShieldCheck className="h-7 w-7 text-blue-500" />
            Supervisor Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Assign branch scope for SUSU supervisors.
          </p>
        </div>
        <Link to="/directory">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Directory
          </Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-600">
          <Check className="h-4 w-4" />
          {message}
        </div>
      )}

      {loading ? (
        <div className="h-80 animate-pulse rounded-xl border border-border bg-card" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px,1fr]">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-10"
                placeholder="Search staff..."
              />
            </div>
            <div className="max-h-[68vh] space-y-1 overflow-y-auto pr-1">
              {filteredStaff.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedId(member.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selectedId === member.id
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-transparent hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{member.fullname}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.branch} - {member.department} category
                      </p>
                    </div>
                    <Badge variant={member.role === "Supervisor" ? "default" : "outline"}>
                      {member.role === "Supervisor" ? "Supervisor" : "Staff"}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selected && (
            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="font-heading text-xl font-bold text-foreground">{selected.fullname}</h2>
                    <p className="text-sm text-muted-foreground">
                      {selected.email} - {selected.branch} - {selected.department} category
                    </p>
                  </div>
                  <Badge variant={role === "Supervisor" ? "default" : "outline"}>{role}</Badge>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                  <div className="flex gap-3">
                    <UserX className="mt-1 h-5 w-5 text-destructive" />
                    <div className="space-y-2">
                      <h3 className="font-semibold text-foreground">Remove supervisor access</h3>
                      <p className="text-xs text-muted-foreground">
                        Removes managed branch access for this supervisor.
                      </p>
                      <Button variant="destructive" size="sm" disabled={saving || selected.role !== "Supervisor"} onClick={removeSupervisor}>
                        Remove Supervisor Access
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                  <div className="flex gap-3">
                    <ArrowRightLeft className="mt-1 h-5 w-5 text-blue-500" />
                    <div className="flex-1 space-y-2">
                      <h3 className="font-semibold text-foreground">Transfer supervisor access</h3>
                      <p className="text-xs text-muted-foreground">
                        Copies this supervisor's access to another staff member, then removes it here.
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <ControlledSelect
                          value={transferTo}
                          onChange={setTransferTo}
                          options={staff.filter((member) => member.id !== selected.id).map((member) => ({ value: member.id, label: member.fullname }))}
                          placeholder="Transfer to..."
                          className="min-w-0 flex-1 rounded-lg border-border bg-background text-sm"
                        />
                        <Button size="sm" disabled={saving || role !== "Supervisor" || !transferTo} onClick={transferSupervisor}>
                          Transfer
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-4 rounded-xl border border-border bg-card p-5">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Role
                    </label>
                    <ControlledSelect
                      value={role}
                      onChange={setRole}
                      options={[{ value: 'GeneralStaff', label: 'Regular Staff' }, { value: 'Supervisor', label: 'Branch Supervisor' }]}
                      className="rounded-lg border-border bg-background text-sm"
                    />
                  </div>

                  <p className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-muted-foreground">
                    Supervisors can review SUSU agents only inside the branches selected here.
                  </p>
                </div>

                <div className="space-y-4 rounded-xl border border-border bg-card p-5">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Managed Branches</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Choose which branches this supervisor can manage.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {branches.map((item) => {
                      const checked = managedBranches.includes(item.toUpperCase());
                      return (
                        <label key={item} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                          <Checkbox
                            checked={checked}
                            disabled={role !== "Supervisor"}
                            onCheckedChange={(value) => toggleBranch(item, value === true)}
                          />
                          <span className="text-sm text-foreground">{item}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button disabled={saving} onClick={saveSupervisor}>
                  {saving ? "Saving..." : "Save Supervisor Access"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
