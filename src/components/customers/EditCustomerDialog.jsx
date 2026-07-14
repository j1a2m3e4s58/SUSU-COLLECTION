import React, { useEffect, useState } from 'react';
import { updateCustomer } from '@/api/portalClient';
import ControlledSelect from '@/components/ui/controlled-select';
import { AlertCircle, Loader2, X } from 'lucide-react';

export default function EditCustomerDialog({ customer, open, onClose, onSaved, branches }) {
  const [form, setForm] = useState({
    account_name: '',
    account_number: '',
    phone: '',
    branch_name: '',
    customer_status: 'active',
    address: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!customer) return;
    setForm({
      account_name: customer.account_name || '',
      account_number: customer.account_number || '',
      phone: customer.phone || '',
      branch_name: customer.branch_name || customer.branch_id || '',
      customer_status: customer.customer_status || 'active',
      address: customer.address || '',
    });
    setError('');
  }, [customer]);

  if (!open || !customer) return null;

  const handleChange = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleSave = async () => {
    if (!form.account_name.trim() || !form.account_number.trim() || !form.branch_name.trim()) {
      setError('Please fill in account name, account number, and branch.');
      return;
    }
    if (!/^\d{13}$/.test(form.account_number.trim())) {
      setError('Account number must be exactly 13 digits.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await updateCustomer(customer.id, form);
      onSaved(updated);
    } catch (err) {
      setError(err.message || 'Could not update customer.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40";
  const branchOptions = branches?.length ? branches : ['HEAD OFFICE', 'BAWJIASE', 'ADEISO', 'OFAAKOR', 'KASOA NEW MARKET', 'KASOA MAIN'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-foreground">Edit Customer</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Account Name *">
            <input className={inputClass} value={form.account_name} onChange={(event) => handleChange('account_name', event.target.value)} />
          </Field>
          <Field label="Account Number *">
            <input className={inputClass} value={form.account_number} onChange={(event) => handleChange('account_number', event.target.value.replace(/\D/g, '').slice(0, 13))} inputMode="numeric" maxLength={13} />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={form.phone} onChange={(event) => handleChange('phone', event.target.value)} />
          </Field>
          <Field label="Branch *">
            <ControlledSelect
              value={form.branch_name}
              onChange={(value) => handleChange('branch_name', value)}
              options={branchOptions}
              placeholder="Select a branch"
              className={inputClass}
              contentClassName="z-[120]"
            />
          </Field>
          <Field label="Status">
            <ControlledSelect value={form.customer_status} onChange={(value) => handleChange('customer_status', value)} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'suspended', label: 'Suspended' }]} className={inputClass} />
          </Field>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg bg-muted py-2.5 text-sm font-medium text-foreground hover:bg-muted/70">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
