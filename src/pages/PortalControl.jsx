import React, { useEffect, useState } from "react";
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
  clearTestData,
  exportBackup,
  getPortalSettings,
  getStoredPortalControlPassword,
  importBackup,
  updatePortalSettings,
} from "@/api/portalClient";
import { useAuth } from "@/lib/AuthContext";
import { Building2, Download, ListPlus, Plus, RotateCcw, Save, Settings2, Trash2, Upload, X } from "lucide-react";

const listControls = [
  ["branches", "Branches", "Branch", "Add branch name"],
];

const textFields = [
  ["bankName", "Bank Name"],
  ["shortBankName", "Short Name"],
  ["portalName", "Portal Name"],
  ["emailDomain", "Email Domain"],
  ["loginSubtitle", "Login Subtitle"],
  ["loginButtonText", "Login Button Text"],
  ["authorizedAccessText", "Authorized Access Text"],
  ["portalControlPassword", "Portal Control Password"],
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

function ListEditor({ title, singular, items, placeholder, onChange }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [itemError, setItemError] = useState("");

  const addItem = () => {
    const item = value.trim().toUpperCase();
    if (!item) {
      setItemError(`Enter a ${singular.toLowerCase()} name.`);
      return;
    }
    if ((items || []).some((current) => current.toUpperCase() === item)) {
      setItemError(`${item} already exists.`);
      return;
    }
    onChange(cleanList([...(items || []), item]));
    setValue("");
    setItemError("");
    setOpen(false);
  };

  const removeItem = (item) => {
    onChange((items || []).filter((current) => current !== item));
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-base font-bold text-foreground">{title}</h2>
          <Badge variant="secondary">{items?.length || 0}</Badge>
        </div>
        <Button type="button" size="sm" className="gap-2" onClick={() => setOpen(true)}>
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => removeItem(item)}
              disabled={(items || []).length <= 1}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[360px] rounded-xl p-5 sm:max-w-md sm:p-6">
          <DialogHeader>
            <DialogTitle>Add {singular}</DialogTitle>
            <DialogDescription>
              This will be added to Portal Control. Press Save Changes after adding to apply it across the app.
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
                if (event.key === "Enter") addItem();
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
            <Button type="button" className="w-full sm:w-auto" onClick={addItem}>
              Add
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
  const [clearBackupReady, setClearBackupReady] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;
    getPortalSettings()
      .then((data) => {
        if (!mounted) return;
        setSettings(data);
        setDraft(data);
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

    const payload = {
      ...draft,
      branches: cleanList(draft.branches),
      departments: ["SUSU", "SUSU AGENT"],
      formCategories: [],
      trainingCategories: [],
      supportIssueCategories: [],
      supportRequestTypes: [],
      departmentChangeTypes: [],
      transferLocations: [],
      appMode: draft.appMode === "live" ? "live" : "test",
    };

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await updatePortalSettings(payload, password);
      setSettings(updated);
      setDraft(updated);
      await refreshPortalSettings?.();
      setSuccess("SUSU system settings saved. Branches now apply across registration, directory, branches, reports, and the app shell.");
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

      <section className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-heading text-base font-bold text-foreground">Launch Safety</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use Test Mode while checking workflows. Switch to Live Mode only when real collections begin.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={draft.appMode || "test"}
              onChange={(event) => update("appMode", event.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="test">Test Mode</option>
              <option value="live">Live Mode</option>
            </select>
            <Button type="button" variant="outline" className="gap-2 bg-background/70" onClick={downloadBackup} disabled={exporting}>
              <Download className="h-4 w-4" />
              {exporting ? "Exporting..." : "Export Backup"}
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background/70 px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
              <Upload className="h-4 w-4" />
              {importing ? "Importing..." : "Import Backup"}
              <input type="file" accept="application/json,.json" className="hidden" onChange={uploadBackup} disabled={importing} />
            </label>
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
            ["Storage", "Confirm Render has persistent disk/database before real deposits."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-xl border border-border bg-background/60 p-3">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
            </div>
          ))}
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
        {listControls.map(([key, title, singular, placeholder]) => (
          <ListEditor
            key={key}
            title={title}
            singular={singular}
            placeholder={placeholder}
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
