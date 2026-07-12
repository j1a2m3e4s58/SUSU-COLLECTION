import React from 'react';
import { Wrench } from 'lucide-react';

export default function PlaceholderPage({ title, description }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl lg:text-3xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="flex flex-col items-center justify-center py-20 bg-card rounded-xl border border-border">
        <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
          <Wrench className="w-8 h-8 text-blue-500" />
        </div>
        <h3 className="font-semibold text-foreground mb-1">Module Under Construction</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md px-4">
          This section is being built and will be available in the next update.
        </p>
      </div>
    </div>
  );
}