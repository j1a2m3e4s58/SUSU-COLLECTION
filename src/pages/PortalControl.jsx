import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ControlledSelect from "@/components/ui/controlled-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  clearTestData,
  exportBackup,
  getPortalSettings,
  getProductionStatus,
  getStoredPortalControlPassword,
  importBackup,
  removeTestCustomers,
  seedTestCustomers,
  updatePortalSettings,
} from "@/api/portalClient";
import { useAuth } from "@/lib/AuthContext";
import { Building2, Download, ListPlus, Pencil, Plus, RotateCcw, Save, Settings2, Trash2, Upload, X } from "lucide-react";

const listControls = [
  ["branches", "Branches", "Branch", "Add branch name", []],
  ["departments", "Departments", "Department", "Add department name", ["SUSU", "SUSU AGENT"]],
];

const textFields = [
  ["bankName", "Bank Name"],
  ["shortBankName", "Short Name"],
  ["portalName", "Portal Name"],
  ["emailDomain", "Email Domain"],
  ["loginSubtitle", "Login Subtitle"],
  ["loginButtonText", "Login Button Text"],
  ["authorizedAccessText", "Authorized Access Text"],
];

const labelFields = [
  ["dashboardLabel", "Dashboard Label"],
  ["profileLabel", "Profile Label"],
  ["activeStaffLabel", "Active Staff Label"],
  ["branchCoverageLabel", "Branch Coverage Label"],
  ["openOperationsLabel", "Open Operations Label"],
  ["resolutionRateLabel", "Resolution Rate Label"],
];

const numberFields = [
  ["sessionDays", "Session Days"],
  ["verificationMinutes", "Verification Code Minutes"],
  ["passwordResetMinutes", "Password Reset Minutes"],
];

function cleanList(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map((item) => String(item || "").trim().toUpperCase())
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function ListEditor({ title, singular, items, placeholder, protectedItems = [], onChange }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState("");
  const [itemError, setItemError] = useState("");
  const protectedSet = new Set((protectedItems || []).map((item) => String(item).trim().toUpperCase()));

  const openAddDialog = () => {
    setEditingItem("");
    setValue("");
    setItemError("");
    setOpen(true);
  };

  const openEditDialog = (item) => {
    setEditingItem(item);
    setValue(item);
    setItemError("");
    setOpen(true);
  };

  const saveItem = () => {
    const item = value.trim().toUpperCase();
    if (!item) {
      setItemError(`Enter a ${singular.toLowerCase()} name.`);
      return;
    }
    if ((items || []).some((current) => current.toUpperCase() === item && current !== editingItem)) {
      setItemError(`${item} already exists.`);
      return;
    }
    if (editingItem) {
      onChange(cleanList((items || []).map((current) => (current === editingItem ? item : current))));
    } else {
      onChange(cleanList([...(items || []), item]));
    }
    setValue("");
    setEditingItem("");
    setItemError("");
    setOpen(false);
  };

  const removeItem = (item) => {
    if (protectedSet.has(String(item || "").trim().toUpperCase())) {
      setItemError(`${item} is required by the SUSU workflow and cannot be deleted.`);
      return;
    }
    onChange((items || []).filter((current) => current !== item));
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-base font-bold text-foreground">{title}</h2>
          <Badge variant="secondary">{items?.length || 0}</Badge>
        </div>
        <Button type="button" size="sm" className="gap-2" onClick={openAddDialog}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {(items || []).map((item) => (
          <div key={item} className="flex items-center justify-between rounded-lg border border-border p-3">
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
              <Building2 className="h-4 w-4 shrink-0 text-blue-500" />
              <span className="break-words">{item}</span>
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-blue-600 hover:bg-blue-500/10 hover:text-blue-700"
                onClick={() => openEditDialog(item)}
                disabled={protectedSet.has(String(item || "").trim().toUpperCase())}
                title={protectedSet.has(String(item || "").trim().toUpperCase()) ? "Required department" : `Edit ${item}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => removeItem(item)}
                disabled={(items || []).length <= 1 || protectedSet.has(String(item || "").trim().toUpperCase())}
                title={protectedSet.has(String(item || "").trim().toUpperCase()) ? "Required department" : "Remove"}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      {itemError && !open && <p className="mt-3 text-sm text-destructive">{itemError}</p>}
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setEditingItem("");
            setValue("");
            setItemError("");
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[360px] rounded-xl p-5 sm:max-w-md sm:p-6">
          <DialogHeader>
            <DialogTitle>{editingItem ? `Edit ${singular}` : `Add ${singular}`}</DialogTitle>
            <DialogDescription>
              {editingItem
                ? `Rename ${editingItem}. Press Save Changes after editing to apply it across the app.`
                : "This will be added to Portal Control. Press Save Changes after adding to apply it across the app."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{singular} Name</Label>
            <Input
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setItemError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveItem();
              }}
              placeholder={placeholder}
              autoFocus
            />
            {itemError && <p className="text-sm text-destructive">{itemError}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="w-full sm:w-auto" onClick={saveItem}>
              {editingItem ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default function PortalControl() {
  const { refreshPortalSettings } = useAuth();
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [seedingCustomers, setSeedingCustomers] = useState(false);
  const [removingTestCustomers, setRemovingTestCustomers] = useState(false);
  const [clearBackupReady, setClearBackupReady] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [productionStatus, setProductionStatus] = useState(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      getPortalSettings(),
      getProductionStatus().catch(() => null),
    ])
      .then(([data, status]) => {
        if (!mounted) return;
        setSettings(data);
        setDraft(data);
        setProductionStatus(status);
        setError("");
      })
      .catch((err) => {
        if (mounted) setError(err.message || "Could not load portal settings");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const update = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const saveSettings = async () => {
    const password = getStoredPortalControlPassword();
    if (!password) {
      setError("Open Portal Control from the sidebar and enter the password first.");
      return;
    }
    if ((settings?.appMode || "test") !== "live" && draft.appMode === "live" && !clearBackupReady) {
      setError("Export a backup before switching the portal to Live Mode.");
      return;
    }
    if ((settings?.appMode || "test") !== "live" && draft.appMode === "live") {
      try {
        const status = await getProductionStatus();
        if (!status.liveReady) {
          const missing = Object.values(status.checks || {})
            .filter((item) => !item.ok)
            .map((item) => item.label)
            .join(", ");
          setError(`Live Mode is blocked until production checks pass: ${missing || "missing production configuration"}.`);
          return;
        }
      } catch (err) {
        setError(err.message || "Could not verify production readiness before Live Mode.");
        return;
      }
    }

    const payload = {
      ...draft,
      branches: cleanList(draft.branches),
      departments: cleanList(draft.departments),
      formCategories: [],
      trainingCategories: [],
      departmentChangeTypes: [],
      transferLocations: [],
      appMode: draft.appMode === "live" ? "live" : "test",
      publicRegistrationEnabled: draft.publicRegistrationEnabled === true,
    };

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await updatePortalSettings(payload, password);
      setSettings(updated);
      setDraft(updated);
      await refreshPortalSettings?.();
      setSuccess("SUSU system settings saved. Branches and departments now apply across registration, directory, branches, reports, and the app shell.");
    } catch (err) {
      setError(err.message || "Could not save portal settings");
    } finally {
      setSaving(false);
    }
  };

  const hasUnsavedChanges = JSON.stringify(draft || {}) !== JSON.stringify(settings || {});

  const resetDraft = () => {
    setDraft(settings);
    setError("");
    setSuccess("Unsaved changes have been reset.");
  };

  const downloadBackup = async () => {
    setExporting(true);
    setError("");
    setSuccess("");
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup.data, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = backup.filename;
      link.click();
      URL.revokeObjectURL(link.href);
      setClearBackupReady(true);
      setSuccess("Backup export prepared.");
    } catch (err) {
      setError(err.message || "Could not export backup.");
    } finally {
      setExporting(false);
    }
  };

  const uploadBackup = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    setError("");
    setSuccess("");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const response = await importBackup(parsed);
      if (response.settings) {
        setSettings(response.settings);
        setDraft(response.settings);
      }
      await refreshPortalSettings?.();
      setSuccess("Backup imported successfully. Refresh other open tabs before continuing.");
    } catch (err) {
      setError(err.message || "Could not import backup file.");
    } finally {
      setImporting(false);
    }
  };

  const clearTestingData = async () => {
    if (!clearBackupReady) {
      setError("Export a backup before clearing test data.");
      return;
    }
    if (draft.appMode !== "test") {
      setError("Switch to Test Mode and save before clearing test data.");
      return;
    }
    setClearing(true);
    setError("");
    setSuccess("");
    try {
      await clearTestData();
      setClearBackupReady(false);
      setSuccess("Test customers, collections, notifications, daily closes, and audit noise were cleared.");
    } catch (err) {
      setError(err.message || "Could not clear test data.");
    } finally {
      setClearing(false);
    }
  };

  const loadTestCustomers = async () => {
    if (draft.appMode !== "test") {
      setError("Switch to Test Mode and save before loading test customers.");
      return;
    }
    setSeedingCustomers(true);
    setError("");
    setSuccess("");
    try {
      const result = await seedTestCustomers();
      setSuccess(`Loaded ${result.createdCount || 0} test customer(s). Existing sample accounts were skipped automatically.`);
    } catch (err) {
      setError(err.message || "Could not load test customers.");
    } finally {
      setSeedingCustomers(false);
    }
  };

  const clearOnlyTestCustomers = async () => {
    if (draft.appMode !== "test") {
      setError("Switch to Test Mode before removing test customers.");
      return;
    }
    setRemovingTestCustomers(true);
    setError("");
    setSuccess("");
    try {
      const result = await removeTestCustomers();
      setSuccess(`Removed ${result.removedCount || 0} test customer(s). Real customers were left untouched.`);
    } catch (err) {
      setError(err.message || "Could not remove test customers.");
    } finally {
      setRemovingTestCustomers(false);
    }
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />;
  }

  if (!draft) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error || "Portal settings could not be loaded."}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Owner controls</p>
          <h1 className="mt-1 flex items-center gap-2 font-heading text-2xl font-bold text-foreground lg:text-3xl">
            <Settings2 className="h-7 w-7 text-blue-500" />
            SUSU Control
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Changes here are saved to backend settings and used by login, registration, directory, branches, reports, and supervisor scope.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasUnsavedChanges && <Badge variant="secondary">Unsaved changes</Badge>}
          <Button type="button" variant="outline" className="gap-2" onClick={downloadBackup} disabled={exporting} title="Export a full JSON backup before testing">
            <Download className="h-4 w-4" />
            {exporting ? "Exporting..." : "Export Backup"}
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={resetDraft} disabled={!hasUnsavedChanges || saving}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button className="gap-2" onClick={saveSettings} disabled={saving || !hasUnsavedChanges}>
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
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

      {productionStatus && (
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-heading text-base font-bold text-foreground">Production Checks</h2>
              <p className="text-sm text-muted-foreground">Live Mode requires database storage, trusted URLs, mail, and portal password protection.</p>
            </div>
            <Badge variant={productionStatus.liveReady ? "default" : "secondary"}>
              {productionStatus.liveReady ? "Live ready" : "Action needed"}
            </Badge>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Object.entries(productionStatus.checks || {}).map(([key, item]) => (
              <div key={key} className={`rounded-lg border p-3 text-sm ${item.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>
                <span className="font-semibold">{item.ok ? "Ready" : "Missing"}</span>
                <p className="mt-1 text-xs opacity-90">{item.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-heading text-base font-bold text-foreground">Launch Safety</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use Test Mode while checking workflows. Switch to Live Mode only when real collections begin.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ControlledSelect
              value={draft.appMode || "test"}
              onChange={(value) => update("appMode", value)}
              options={[
                { value: "test", label: "Test Mode" },
                { value: "live", label: "Live Mode" },
              ]}
              placeholder="Select mode"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <label className="inline-flex min-h-10 items-center gap-3 rounded-lg border border-border bg-background/70 px-4 py-2 text-sm font-medium text-foreground">
              <Switch
                checked={draft.publicRegistrationEnabled === true}
                onCheckedChange={(checked) => update("publicRegistrationEnabled", checked === true)}
              />
              <span className="leading-tight">
                Show public Sign Up
                <span className="block text-xs font-normal text-muted-foreground">Allows New Staff? Sign Up on login</span>
              </span>
            </label>
            <Button type="button" variant="outline" className="gap-2 bg-background/70" onClick={downloadBackup} disabled={exporting}>
              <Download className="h-4 w-4" />
              {exporting ? "Exporting..." : "Export Backup"}
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background/70 px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
              <Upload className="h-4 w-4" />
              {importing ? "Importing..." : "Import Backup"}
              <input type="file" accept="application/json,.json" className="hidden" onChange={uploadBackup} disabled={importing} />
            </label>
            <Button type="button" variant="outline" className="gap-2 bg-background/70" onClick={loadTestCustomers} disabled={seedingCustomers || draft.appMode !== "test"}>
              <ListPlus className="h-4 w-4" />
              {seedingCustomers ? "Loading..." : "Load Test Customers"}
            </Button>
            <Button type="button" variant="outline" className="gap-2 bg-background/70 text-destructive hover:text-destructive" onClick={clearOnlyTestCustomers} disabled={removingTestCustomers || draft.appMode !== "test"}>
              <X className="h-4 w-4" />
              {removingTestCustomers ? "Removing..." : "Remove Test Customers"}
            </Button>
            <Button type="button" variant="destructive" className="gap-2" onClick={clearTestingData} disabled={clearing || !clearBackupReady || draft.appMode !== "test"}>
              <Trash2 className="h-4 w-4" />
              {clearing ? "Clearing..." : "Clear Test Data"}
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Clear Test Data unlocks only after exporting a backup and only while the portal is in Test Mode.
        </p>
      </section>

      <section className="rounded-xl border border-emerald-500/20 bg-card p-5">
        <h2 className="font-heading text-base font-bold text-foreground">Ready For Real Testing</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Backup", "Export a full backup before Live Mode and before deleting records."],
            ["Roles", "Test Owner, Supervisor, and SUSU AGENT accounts separately."],
            ["Imports", "Upload customer CSV/Excel with 13-digit account numbers only."],
            ["Storage", "Confirm Render has persistent disk or a real database before real deposits."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-xl border border-border bg-background/60 p-3">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Live Mode should only be used after backup export and persistent storage are confirmed in Render. Without persistent storage, customer and deposit records can disappear after redeploy or restart.
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 font-heading text-lg font-bold text-foreground">Brand, Login, and Access</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {textFields.map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label>{label}</Label>
              <Input
                type={key.toLowerCase().includes("password") || key.toLowerCase().includes("code") ? "password" : "text"}
                value={draft[key] || ""}
                onChange={(event) => update(key, event.target.value)}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-bold text-foreground">
          <ListPlus className="h-5 w-5 text-blue-500" />
          App Labels
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {labelFields.map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label>{label}</Label>
              <Input value={draft[key] || ""} onChange={(event) => update(key, event.target.value)} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 font-heading text-lg font-bold text-foreground">Timing</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {numberFields.map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label>{label}</Label>
              <Input
                type="number"
                min="1"
                value={draft[key] ?? ""}
                onChange={(event) => update(key, Number(event.target.value || 1))}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {listControls.map(([key, title, singular, placeholder, protectedItems]) => (
          <ListEditor
            key={key}
            title={title}
            singular={singular}
            placeholder={placeholder}
            protectedItems={protectedItems}
            items={draft[key] || []}
            onChange={(items) => update(key, items)}
          />
        ))}
      </div>

      {settings?.updatedBy && (
        <p className="text-xs text-muted-foreground">
          Last updated by {settings.updatedBy.fullname}.
        </p>
      )}
    </div>
  );
}
