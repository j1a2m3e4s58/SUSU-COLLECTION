import React from 'react';
import { Check, User, Hash, Building2, Calendar, Clock, HandCoins, Plus, Printer } from 'lucide-react';

export default function ReceiptCard({ receipt, onClose }) {
  const rows = [
    { icon: Hash, label: 'Reference', value: receipt.transaction_reference },
    { icon: User, label: 'Customer', value: receipt.account_name },
    { icon: Hash, label: 'Account Number', value: receipt.account_number },
    { icon: HandCoins, label: 'Amount Deposited', value: `GH₵${(receipt.amount || 0).toLocaleString()}`, highlight: true },
    { icon: User, label: 'Recorded By', value: receipt.recorded_by },
    { icon: Building2, label: 'Branch', value: receipt.branch_name },
    { icon: Calendar, label: 'Date', value: receipt.transaction_date },
    { icon: Clock, label: 'Time', value: receipt.transaction_time },
  ];

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-xl">
        <div className="bg-emerald-500/10 p-6 text-center border-b border-border">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500 flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/30 animate-[pulse_2s_ease-in-out]">
            <Check className="w-8 h-8 text-white" strokeWidth={3} />
          </div>
          <h3 className="font-heading text-xl font-bold text-foreground">Deposit Recorded</h3>
          <p className="text-xs text-muted-foreground mt-1">Transaction saved successfully</p>
        </div>
        <div className="p-5 space-y-0">
          {rows.map((row, i) => {
            const Icon = row.icon;
            return (
              <div key={i} className={`flex items-center justify-between py-2.5 ${i < rows.length - 1 ? 'border-b border-border/50' : ''}`}>
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                </div>
                <span className={`text-sm ${row.highlight ? 'text-emerald-500 font-bold text-base' : 'text-foreground font-medium'}`}>
                  {row.value}
                </span>
              </div>
            );
          })}
        </div>
        <div className="p-4 border-t border-border flex gap-2">
          <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-2 bg-muted hover:bg-muted/70 text-foreground text-sm font-medium py-2.5 rounded-lg transition-colors">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={onClose} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors shadow-lg shadow-blue-600/25">
            <Plus className="w-4 h-4" /> New Collection
          </button>
        </div>
      </div>
    </div>
  );
}