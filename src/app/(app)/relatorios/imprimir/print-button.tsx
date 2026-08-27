'use client';

import { Printer } from 'lucide-react';

export function PrintButton() {
  return (
    <div className="mb-4 flex justify-end print:hidden">
      <button className="btn-primary" onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> Imprimir / salvar em PDF
      </button>
    </div>
  );
}
