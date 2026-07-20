import React, { useEffect, useState } from 'react';
import { deleteStaff, exportBackup, getArchivedStaff, resolveAssetUrl, restoreStaff } from '@/api/portalClient';
import { ArchiveRestore, Mail, Phone, Trash2, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ConfirmActionDialog from '@/components/ui/confirm-action-dialog';

function initials(name) {
  return String(name || 'User').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

export default function PastStaff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBackupReady, setDeleteBackupReady] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setStaff(await getArchivedStaff());
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load past staff');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleRestore = async (member) => {
    setBusyId(member.id);
    setError('');
    setSuccess('');
    try {
      await restoreStaff(member.id);
      setStaff((current) => current.filter((item) => item.id !== member.id));
      setSuccess(`${member.fullname} has been restored to the active directory.`);
    } catch (err) {
      setError(err.message || 'Could not restore staff member');
    }
    setBusyId('');
  };

  const handleDelete = async (member) => {
    if (!deleteBackupReady) {
      setError('Export a backup before deleting this account.');
      return;
    }
    setBusyId(member.id);
    setError('');
    setSuccess('');
    try {
      await deleteStaff(member.id, true);
      setStaff((current) => current.filter((item) => item.id !== member.id));
      setSuccess(`${member.fullname} has been permanently removed.`);
    } catch (err) {
      setError(err.message || 'Could not delete staff member');
    }
    setDeleteTarget(null);
    setBusyId('');
  };

  const exportDeleteBackup = async () => {
    setExportingBackup(true);
    setError('');
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = backup.filename || `susu-portal-backup-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDeleteBackupReady(true);
      setSuccess('Backup exported. You can now delete this account.');
    } catch (err) {
      setError(err.message || 'Could not export a backup.');
    } finally {
      setExportingBackup(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Archived records</p>
        <h1 className="mt-1 flex items-center gap-2 font-heading text-2xl font-bold text-foreground lg:text-3xl">
          <UserX className="h-7 w-7 text-blue-500" />
          Past Staff
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Restore archived staff or permanently remove an account so the person can sign up again.</p>
      </div>

      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-600">{success}</div>}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-48 animate-pulse rounded-xl border border-border bg-card" />)}
        </div>
      ) : staff.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <UserX className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No archived staff records.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {staff.map((member) => {
            const photo = resolveAssetUrl(member.imageFile);
            return (
              <div key={member.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-blue-500/10 text-blue-600">
                    {photo ? <img src={photo} alt={member.fullname} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-sm font-bold">{initials(member.fullname)}</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-sm font-semibold text-foreground">{member.fullname}</h2>
                      <Badge variant="secondary">{member.role}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{member.department || '-'} · {member.branch || '-'}</p>
                    <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                      <p className="flex items-center gap-2 break-all"><Mail className="h-3.5 w-3.5" />{member.email}</p>
                      <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{member.phone || '-'}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3">
                  <Button type="button" variant="outline" size="sm" className="gap-2" disabled={busyId === member.id} onClick={() => handleRestore(member)}>
                    <ArchiveRestore className="h-4 w-4" />
                    Restore
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={busyId === member.id} onClick={() => { setDeleteBackupReady(false); setDeleteTarget(member); }}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ConfirmActionDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Permanently delete staff?"
        description={`Permanently delete ${deleteTarget?.fullname || 'this staff member'}? This clears their login so they can sign up again.`}
        confirmLabel="Delete"
        destructive
        busy={Boolean(busyId)}
        confirmDisabled={!deleteBackupReady}
        secondaryLabel="Export Backup"
        secondaryBusy={exportingBackup}
        onSecondary={exportDeleteBackup}
        notice={deleteBackupReady ? 'Backup exported. Financial history will be preserved.' : 'Export a backup before permanently deleting this login account.'}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
      />
    </div>
  );
}
