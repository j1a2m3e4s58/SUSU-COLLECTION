import React, { useEffect, useMemo, useState } from "react";
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
import {
  getActiveStaff,
  getPortalSettings,
  getStoredPortalControlPassword,
  updatePortalSettings,
} from "@/api/portalClient";
import { useAuth } from "@/lib/AuthContext";
import { Building2, Plus, Search, ShieldCheck, Users } from "lucide-react";

export default function BranchManagement() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [branches, setBranches] = useState([]);
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canChangeBranches = user?.role === "OwnerAdmin";

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [settings, users] = await Promise.all([
          getPortalSettings(),
          getActiveStaff(),
        ]);
        if (!mounted) return;
        setSettings(settings);
        setBranches(settings.branches || []);
        setStaff((users || []).filter((member) => member.role !== "OwnerAdmin"));
        setError("");
      } catch (err) {
        if (mounted) setError(err.message || "Could not load branch data");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    const intervalId = window.setInterval(load, 10000);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const handleAddBranch = async () => {
    const branchName = newBranch.trim().toUpperCase();
    setError("");
    setSuccess("");
    if (!branchName) {
      setError("Enter a branch name.");
      return;
    }
    if (branches.some((item) => item.toUpperCase() === branchName)) {
      setError("This branch already exists.");
      return;
    }
    if (!canChangeBranches) {
      setError("Only the Owner Admin can add branches because this changes system-wide registration and reporting lists.");
      return;
    }
    const portalPassword = getStoredPortalControlPassword();
    if (!portalPassword) {
      setError("Open Portal Control from the sidebar and enter the password before adding branches.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updatePortalSettings(
        {
          ...(settings || {}),
          branches: [...branches, branchName],
        },
        portalPassword
      );
      setSettings(updated);
      setBranches(updated.branches || []);
      setNewBranch("");
      setAddOpen(false);
      setSuccess(`${branchName} has been added and will appear in registration.`);
    } catch (err) {
      setError(err.message || "Could not add branch");
    } finally {
      setSaving(false);
    }
  };

  const branchRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return branches
      .map((branch, index) => {
        const members = staff.filter((member) => member.branch === branch);
        const online = members.filter((member) => member.isOnlineNow).length;
        const supervisors = members.filter((member) => member.role === "Supervisor").length;
        const agents = members.filter((member) =>
          ["SUSU", "SUSU AGENT", "SUSU SUPERVISOR"].includes(String(member.department || "").trim().toUpperCase()) &&
          member.role !== "Supervisor" &&
          !["OwnerAdmin", "SuperAdmin"].includes(member.role)
        ).length;
        return {
          id: branch,
          name: branch,
          code: `${branch.replace(/[^A-Z0-9]/gi, "").slice(0, 3).toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
          total: members.length,
          online,
          supervisors,
          agents,
          status: members.length > 0 ? "active" : "no staff",
        };
      })
      .filter((branch) => !q || branch.name.toLowerCase().includes(q) || branch.code.toLowerCase().includes(q));
  }, [branches, staff, search]);

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">
            Branch coverage
          </p>
          <h1 className="mt-1 flex items-center gap-2 font-heading text-2xl font-bold text-foreground lg:text-3xl">
            <Building2 className="h-7 w-7 text-blue-500" />
            Branches
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Branches are loaded from the local portal backend settings.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:max-w-xl sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search branches..."
              className="pl-10"
            />
          </div>
          {canChangeBranches && (
            <Button type="button" className="gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Branch
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Branches</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{branches.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Active Staff</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{staff.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Online Staff</p>
          <p className="mt-1 text-2xl font-bold text-emerald-500">{staff.filter((member) => member.isOnlineNow).length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Covered Branches</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{branchRows.filter((item) => item.total > 0).length}</p>
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-44 animate-pulse rounded-xl border border-border bg-card" />
            ))
          : branchRows.map((branch) => (
              <div key={branch.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10">
                    <Building2 className="h-5 w-5 text-blue-500" />
                  </div>
                  <Badge variant={branch.total > 0 ? "default" : "outline"}>
                    {branch.status}
                  </Badge>
                </div>
                <h3 className="font-semibold text-foreground">{branch.name}</h3>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{branch.code}</p>
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {branch.total} staff, {branch.online} online
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" />
                  {branch.supervisors} supervisors, {branch.agents} SUSU agents
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                    SUSU: {branch.supervisors}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                    SUSU AGENTS: {branch.agents}
                  </span>
                </div>
              </div>
            ))}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Branch</DialogTitle>
            <DialogDescription>
              New branches are saved to SUSU system settings and appear in registration, directory filters, and branch reports.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-branch">Branch Name</Label>
              <Input
                id="new-branch"
                value={newBranch}
                onChange={(event) => setNewBranch(event.target.value)}
                placeholder="e.g. AWUTU BRANCH"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddBranch} disabled={saving}>
              {saving ? "Adding..." : "Add Branch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
