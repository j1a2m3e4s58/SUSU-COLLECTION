import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, BarChart3, Receipt, Users } from 'lucide-react';

export default function WelcomeHero({ user }) {
  const name = user?.full_name || 'User';
  const branch = user?.branch_name || 'All Branches';
  const isSusuAgent = String(user?.department || '').trim().toUpperCase() === 'SUSU AGENT';

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-blue-950/30 border border-border p-5 lg:p-8">
      <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4 pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl translate-y-1/2 pointer-events-none" />

      <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Live Sync Active
            </span>
            <span className="text-xs text-muted-foreground">Updated just now</span>
          </div>
          <h1 className="font-heading text-2xl lg:text-4xl font-bold text-foreground mb-1.5">
            Welcome, {name}!
          </h1>
          <p className="text-sm text-muted-foreground">
            Susu Field Collection Portal · {branch}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 lg:gap-3">
          {isSusuAgent && (
            <Link to="/field-collection" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg shadow-blue-600/25 transition-all hover:scale-105">
              <Plus className="w-4 h-4" /> New Collection
            </Link>
          )}
          <Link to="/reports" className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg shadow-purple-600/25 transition-all hover:scale-105">
            <BarChart3 className="w-4 h-4" /> Reports
          </Link>
          <Link to="/transactions" className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg shadow-cyan-600/25 transition-all hover:scale-105">
            <Receipt className="w-4 h-4" /> Transactions
          </Link>
          <Link to="/customers" className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg shadow-emerald-600/25 transition-all hover:scale-105">
            <Users className="w-4 h-4" /> Customers
          </Link>
        </div>
      </div>
    </div>
  );
}
