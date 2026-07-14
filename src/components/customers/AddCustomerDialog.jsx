import React, { useState } from 'react';
import { createCustomer } from '@/api/portalClient';
import ControlledSelect from '@/components/ui/controlled-select';
import { useAuth } from '@/lib/AuthContext';
import { X, AlertCircle, Loader2 } from 'lucide-react';

export default function AddCustomerDialog({ open, onClose, onSaved, branches }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    account_name: '', account_number: '', phone: '', branch_id: '', customer_status: 'active'
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.account_name || !form.account_number || !form.branch_id) {
      setError('Please fill in account name, account number, and branch');
      return;
    }
    if (!/^\d{13}$/.test(form.account_number.trim())) {
      setError('Account number must be exactly 13 digits.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const customer = await createCustomer({
        ...form,
        branch_name: form.branch_id,
        total_deposits: 0,
        created_by: user?.id,
      });
      onSaved(customer);
      setForm({ account_name: '', account_number: '', phone: '', branch_id: '', customer_status: 'active' });
    } catch (err) { setError(err.message || 'Failed to save customer. Please try again.'); }
    setSaving(false);
  };

  const inputClass = "w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40";
  const branchOptions = branches?.length ? branches : ['HEAD OFFICE', 'BAWJIASE', 'ADEISO', 'OFAAKOR', 'KASOA NEW MARKET', 'KASOA MAIN'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-heading text-lg font-bold text-foreground">Add New Customer</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Account Name *</label>
            <input className={inputClass} value={form.account_name} onChange={e => handleChange('account_name', e.target.value)} placeholder="e.g. Kwame Mensah" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Account Number *</label>
            <input className={inputClass} value={form.account_number} onChange={e => handleChange('account_number', e.target.value.replace(/\D/g, '').slice(0, 13))} placeholder="13-digit account number" inputMode="numeric" maxLength={13} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Phone Number</label>
            <input className={inputClass} value={form.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="e.g. 0244000001" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Branch *</label>
            <ControlledSelect
              value={form.branch_id}
              onChange={(value) => handleChange('branch_id', value)}
              options={branchOptions}
              placeholder="Select a branch"
              className={inputClass}
              contentClassName="z-[120]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Customer Status</label>
            <ControlledSelect value={form.customer_status} onChange={(value) => handleChange('customer_status', value)} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'suspended', label: 'Suspended' }]} className={inputClass} />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 bg-muted hover:bg-muted/70 text-foreground text-sm font-medium py-2.5 rounded-lg transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Add Customer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
