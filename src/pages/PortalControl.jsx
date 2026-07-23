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
  getStoredPortalAuthorization,
  importBackup,
  normalizeLegacySusuDepartments,
  removeTestCustomers,
  removeTestStaff,
  seedTestCustomers,
  seedTestStaff,
  updatePortalSettings,
} from "@/api/portalClient";
import { useAuth } from "@/lib/AuthContext";
import { ArrowDown, ArrowUp, Building2, Download, FileSpreadsheet, ListPlus, Pencil, Plus, RotateCcw, Save, Settings2, Trash2, Upload, UserMinus, UserPlus, X } from "lucide-react";

const listControls = [
  ["branches", "Branches", "Branch", "Add branch name", []],
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
  ["sessionMinutes", "Inactive Session Minutes"],
  ["absoluteSessionHours", "Maximum Session Hours"],
  ["sensitiveReauthMinutes", "Sensitive Action Confirmation Minutes"],
  ["verificationMinutes", "Verification Code Minutes"],
  ["passwordResetMinutes", "Password Reset Minutes"],
  ["auditRetentionDays", "Audit Log Retention Days"],
  ["notificationRetentionDays", "Read Notification Retention Days"],
  ["verificationRetentionHours", "Expired Verification Retention Hours"],
  ["expiredSessionRetentionDays", "Expired Session Retention Days"],
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

function ListEditor({
  title,
  singular,
  items,
  placeholder,
  protectedItems = [],
  backupReady = false,
  onBackupRequired,
  onChange,
  onRename,
}) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState("");
  const [itemError, setItemError] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
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

  const resetEntryDialog = () => {
    setEditingItem("");
    setValue("");
    setItemError("");
    setOpen(false);
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
      if (protectedSet.has(String(editingItem || "").trim().toUpperCase())) {
        setItemError(`${editingItem} cannot be renamed because the agent workflow depends on it.`);
        return;
      }
      if (editingItem !== item) {
        if (!backupReady) {
          onBackupRequired?.(`${singular} rename needs a backup first. Export Backup, then try again.`);
          return;
        }
        setConfirmAction({ type: "rename", from: editingItem, to: item });
        return;
      }
      onChange(cleanList((items || []).map((current) => (current === editingItem ? item : current))));
    } else {
      onChange(cleanList([...(items || []), item]));
    }
    resetEntryDialog();
  };

  const removeItem = (item) => {
    if (protectedSet.has(String(item || "").trim().toUpperCase())) {
      setItemError(`${item} cannot be removed because the agent workflow depends on it.`);
      return;
    }
    if (!backupReady) {
      onBackupRequired?.(`${singular} removal needs a backup first. Export Backup, then try again.`);
      return;
    }
    setConfirmAction({ type: "delete", item });
  };

  const applyConfirmedAction = () => {
    if (!confirmAction) return;
    if (confirmAction.type === "rename") {
      onRename?.(confirmAction.from, confirmAction.to);
      onChange(cleanList((items || []).map((current) => (current === confirmAction.from ? confirmAction.to : current))));
      resetEntryDialog();
    }
    if (confirmAction.type === "delete") {
      onChange((items || []).filter((current) => current !== confirmAction.item));
    }
    setConfirmAction(null);
    setItemError("");
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
          <div key={item} className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
              <Building2 className="h-4 w-4 shrink-0 text-blue-500" />
              <span className="break-words">{item}</span>
            </span>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center sm:gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 px-2 text-xs text-blue-600 hover:bg-blue-500/10 hover:text-blue-700"
                onClick={() => openEditDialog(item)}
                title={`Edit ${item}`}
              >
                <Pencil className="h-4 w-4" />
                <span>Edit</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => removeItem(item)}
                disabled={(items || []).length <= 1}
                title="Remove"
              >
                <X className="h-4 w-4" />
                <span>Remove</span>
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
      <Dialog open={Boolean(confirmAction)} onOpenChange={(nextOpen) => !nextOpen && setConfirmAction(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[380px] rounded-xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle>{confirmAction?.type === "rename" ? `Rename ${singular}?` : `Remove ${singular}?`}</DialogTitle>
            <DialogDescription>
              {confirmAction?.type === "rename"
                ? `This will change ${confirmAction.from} to ${confirmAction.to} across the portal after you press Save Changes.`
                : `This will remove ${confirmAction?.item} from Portal Control after you press Save Changes.`}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            A backup has been exported for this session. Review carefully before continuing.
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button type="button" className="w-full sm:w-auto" onClick={applyConfirmedAction}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ImportColumnsEditor({ columns, onChange }) {
  const items = Array.isArray(columns) ? columns : [];
  const protectedKeys = new Set(["account_name", "account_number"]);
  const updateLabel = (key, label) => onChange(items.map((item) => item.key === key ? { ...item, label } : item));
  const addColumn = () => {
    const used = new Set(items.map((item) => String(item.label || "").toLowerCase()));
    let index = items.length + 1;
    let label = `Additional Column ${index}`;
    while (used.has(label.toLowerCase())) {
      index += 1;
      label = `Additional Column ${index}`;
    }
    onChange([...items, { key: `custom_${Date.now().toString(36)}`, label, type: "text", required: false }]);
  };
  const move = (index, offset) => {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const remove = (key) => {
    if (!protectedKeys.has(key)) onChange(items.filter((item) => item.key !== key));
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-foreground"><FileSpreadsheet className="h-5 w-5 text-emerald-600" />Customer Import Format</h2>
          <p className="mt-1 text-sm text-muted-foreground">These titles and their order are used in the downloadable Excel template and customer importer.</p>
        </div>
        <Button type="button" size="sm" className="gap-2" onClick={addColumn} disabled={items.length >= 20}><Plus className="h-4 w-4" /> Add Column</Button>
      </div>
      <div className="mt-4 space-y-2">
        {items.map((column, index) => (
          <div key={column.key} className="grid gap-2 rounded-lg border border-border bg-background/60 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <Label htmlFor={`import-column-${column.key}`} className="mb-1.5 flex items-center gap-2 text-xs">
                Column {index + 1}
                {protectedKeys.has(column.key) && <Badge variant="secondary">Required</Badge>}
                {column.type === "account_number" && <Badge>Text · 13 digits</Badge>}
              </Label>
              <Input id={`import-column-${column.key}`} value={column.label || ""} maxLength={60} onChange={(event) => updateLabel(column.key, event.target.value)} aria-label={`Column ${index + 1} title`} />
            </div>
            <div className="grid grid-cols-3 gap-1 sm:flex sm:items-center">
              <Button type="button" variant="ghost" size="sm" onClick={() => move(index, -1)} disabled={index === 0} title="Move up" aria-label={`Move ${column.label} up`}><ArrowUp className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => move(index, 1)} disabled={index === items.length - 1} title="Move down" aria-label={`Move ${column.label} down`}><ArrowDown className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => remove(column.key)} disabled={protectedKeys.has(column.key)} title={protectedKeys.has(column.key) ? "Required banking column" : "Remove column"} aria-label={`Remove ${column.label}`}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Account Name and Account Number cannot be removed. Branch is optional because the selected import branch can be applied to every uploaded row.</p>
    </section>
  );
}

export default function PortalControl() {
  const { refreshPortalSettings } = useAuth();
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState(null);
  const [pendingRenames, setPendingRenames] = useState({ branches: {}, departments: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [seedingCustomers, setSeedingCustomers] = useState(false);
  const [removingTestCustomers, setRemovingTestCustomers] = useState(false);
  const [seedingStaff, setSeedingStaff] = useState(false);
  const [removingTestStaff, setRemovingTestStaff] = useState(false);
  const [normalizingLegacy, setNormalizingLegacy] = useState(false);
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
        setPendingRenames({ branches: {}, departments: {} });
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


  const hasDangerousListChanges = () => {
    const currentBranches = cleanList(settings?.branches || []);
    const nextBranches = cleanList(draft?.branches || []);
    const branchRemoved = currentBranches.some((item) => !nextBranches.includes(item));
    const hasRenames = Object.keys(pendingRenames.branches || {}).length > 0;
    return branchRemoved || hasRenames;
  };
  const recordRename = (key, from, to) => {
    const oldValue = String(from || "").trim().toUpperCase();
    const newValue = String(to || "").trim().toUpperCase();
    if (!oldValue || !newValue || oldValue === newValue) return;
    setPendingRenames((current) => {
      const nextGroup = { ...(current[key] || {}) };
      const existingOriginal = Object.keys(nextGroup).find((item) => nextGroup[item] === oldValue);
      if (existingOriginal) {
        if (existingOriginal === newValue) {
          delete nextGroup[existingOriginal];
        } else {
          nextGroup[existingOriginal] = newValue;
        }
      } else {
        nextGroup[oldValue] = newValue;
      }
      return { ...current, [key]: nextGroup };
    });
  };

  const saveSettings = async () => {
    const portalAuthorization = getStoredPortalAuthorization();
    if (!portalAuthorization) {
      setError("Open Portal Control from the sidebar and enter the password first.");
      return;
    }
    const importColumns = Array.isArray(draft.customerImportColumns) ? draft.customerImportColumns : [];
    const importLabels = importColumns.map((item) => String(item.label || "").trim());
    if (importLabels.some((label) => !label)) {
      setError("Every customer import column must have a title.");
      return;
    }
    if (new Set(importLabels.map((label) => label.toLowerCase())).size !== importLabels.length) {
      setError("Customer import column titles must be unique.");
      return;
    }
    if (hasDangerousListChanges() && !clearBackupReady) {
      setError("Export Backup before renaming or removing any branch or department.");
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
      departments: ["SUSU"],
      branchRenames: pendingRenames.branches,
      departmentRenames: pendingRenames.departments,
      appMode: draft.appMode === "live" ? "live" : "test",
      publicRegistrationEnabled: draft.publicRegistrationEnabled === true,
      customerImportColumns: importColumns,
      backupConfirmed: clearBackupReady,
    };

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await updatePortalSettings(payload, portalAuthorization);
      setSettings(updated);
      setDraft(updated);
      setPendingRenames({ branches: {}, departments: {} });
      await refreshPortalSettings?.();
      setSuccess("SUSU system settings saved. Branches and labels now apply across registration, directory, reports, and the app shell.");
    } catch (err) {
      setError(err.message || "Could not save portal settings");
    } finally {
      setSaving(false);
    }
  };

  const hasUnsavedChanges = JSON.stringify(draft || {}) !== JSON.stringify(settings || {});

  const resetDraft = () => {
    setDraft(settings);
    setPendingRenames({ branches: {}, departments: {} });
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
        setPendingRenames({ branches: {}, departments: {} });
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

  const loadTestStaff = async () => {
    if (draft.appMode !== "test") {
      setError("Switch to Test Mode and save before loading test staff.");
      return;
    }
    setSeedingStaff(true);
    setError("");
    setSuccess("");
    try {
      const result = await seedTestStaff();
      const emails = (result.users || []).map((item) => item.email).filter(Boolean);
      setSuccess(
        emails.length
          ? `Loaded ${emails.length} test staff account(s): ${emails.join(", ")}. They use the configured initial test password.`
          : "All test staff accounts already exist. Existing passwords were not changed."
      );
    } catch (err) {
      setError(err.message || "Could not load test staff.");
    } finally {
      setSeedingStaff(false);
    }
  };

  const clearOnlyTestStaff = async () => {
    if (draft.appMode !== "test") {
      setError("Switch to Test Mode before removing test staff.");
      return;
    }
    setRemovingTestStaff(true);
    setError("");
    setSuccess("");
    try {
      const result = await removeTestStaff();
      setSuccess(`Removed ${result.removedCount || 0} test staff account(s). Existing real staff were left untouched.`);
    } catch (err) {
      setError(err.message || "Could not remove test staff.");
    } finally {
      setRemovingTestStaff(false);
    }
  };

  const normalizeLegacyData = async () => {
    if (!clearBackupReady) {
      setError("Export Backup before normalizing legacy SUSU data.");
      return;
    }
    setNormalizingLegacy(true);
    setError("");
    setSuccess("");
    try {
      const result = await normalizeLegacySusuDepartments(true);
      if (result.settings) {
        setSettings(result.settings);
        setDraft(result.settings);
      }
      await refreshPortalSettings?.();
      setClearBackupReady(false);
      setSuccess(`Legacy SUSU cleanup completed. ${result.normalizedUsers || 0} stored staff record(s) were permanently normalized.`);
    } catch (err) {
      setError(err.message || "Could not normalize legacy SUSU data.");
    } finally {
      setNormalizingLegacy(false);
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
              <p className="text-sm text-muted-foreground">Live Mode requires database storage, trusted URLs, mail, and Owner verification.</p>
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
            <Button type="button" variant="outline" className="gap-2 bg-background/70" onClick={loadTestStaff} disabled={seedingStaff || draft.appMode !== "test"}>
              <UserPlus className="h-4 w-4" />
              {seedingStaff ? "Loading..." : "Load Test Staff"}
            </Button>
            <Button type="button" variant="outline" className="gap-2 bg-background/70 text-destructive hover:text-destructive" onClick={clearOnlyTestStaff} disabled={removingTestStaff || draft.appMode !== "test"}>
              <UserMinus className="h-4 w-4" />
              {removingTestStaff ? "Removing..." : "Remove Test Staff"}
            </Button>
            <Button type="button" variant="outline" className="gap-2 bg-background/70" onClick={normalizeLegacyData} disabled={normalizingLegacy || !clearBackupReady}>
              <RotateCcw className="h-4 w-4" />
              {normalizingLegacy ? "Normalizing..." : "Normalize Legacy SUSU Data"}
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
        <h2 className="font-heading text-base font-bold text-foreground">Post-Deploy Smoke Test</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Run these checks after every Render or cPanel deployment before using real records.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {[
            "Login with owner, supervisor, and SUSU agent",
            "Edit a staff branch in Directory",
            "Add or import a customer",
            "Record an agent collection",
            "Export reports to Excel/PDF",
            "Save Portal Control settings",
          ].map((item) => (
            <div key={item} className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-foreground">
              {item}
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

      <ImportColumnsEditor
        columns={draft.customerImportColumns || []}
        onChange={(columns) => update("customerImportColumns", columns)}
      />

      <section className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-5">
        <h2 className="font-heading text-base font-bold text-foreground">System-managed safeguards</h2>
        <p className="mt-1 text-sm text-muted-foreground">These controls intentionally remain enforced by the backend and cannot be weakened from Portal Control.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {["Account numbers are exactly 13 digits", "Agents remain isolated by branch and ownership", "Only supervisors and Owner can import customers", "Deposit duplicate and audit protections stay enabled"].map((item) => (
            <div key={item} className="rounded-lg border border-border bg-background/70 p-3 text-xs font-medium text-foreground">{item}</div>
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
            backupReady={clearBackupReady}
            onBackupRequired={(message) => setError(message)}
            onChange={(items) => update(key, items)}
            onRename={(from, to) => recordRename(key, from, to)}
          />
        ))}
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading text-base font-bold text-foreground">SUSU Staff Grouping</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          All operational staff use the SUSU department. Directory groups them as SUSU Supervisors or SUSU Agents from their role, not from separate department names.
        </p>
        <Badge className="mt-3">SUSU</Badge>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold text-foreground">Independent Security Review</h2>
            <p className="mt-1 text-sm text-muted-foreground">A qualified reviewer must test the deployed portal before real deposits are accepted. Record the engagement and final report here.</p>
          </div>
          <Badge variant={draft.securityReviewStatus === "completed" ? "default" : "secondary"}>{String(draft.securityReviewStatus || "not-scheduled").replace(/-/g, " ")}</Badge>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Review Status</Label>
            <ControlledSelect
              value={draft.securityReviewStatus || "not-scheduled"}
              onChange={(value) => update("securityReviewStatus", value)}
              options={[
                { value: "not-scheduled", label: "Not Scheduled" },
                { value: "scheduled", label: "Scheduled" },
                { value: "in-progress", label: "In Progress" },
                { value: "remediation-required", label: "Remediation Required" },
                { value: "completed", label: "Completed" },
              ]}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>
          <div className="space-y-1.5"><Label>Reviewer / Security Firm</Label><Input value={draft.securityReviewProvider || ""} onChange={(event) => update("securityReviewProvider", event.target.value)} placeholder="Independent reviewer name" /></div>
          <div className="space-y-1.5"><Label>Report Reference</Label><Input value={draft.securityReviewReference || ""} onChange={(event) => update("securityReviewReference", event.target.value)} placeholder="Report ID or controlled document reference" /></div>
          <div className="space-y-1.5"><Label>Completion Date</Label><Input type="date" value={draft.securityReviewDate || ""} onChange={(event) => update("securityReviewDate", event.target.value)} /></div>
        </div>
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">Do not mark this completed without an independent written report and remediation evidence. Completion is required by the Live readiness check.</div>
      </section>

      {settings?.updatedBy && (
        <p className="text-xs text-muted-foreground">
          Last updated by {settings.updatedBy.fullname}.
        </p>
      )}
    </div>
  );
}
