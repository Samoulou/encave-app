import { Mail, Phone, Hash } from 'lucide-react';

interface BookingRowExpandedProps {
  visitorEmail: string;
  visitorPhone: string;
  reference: string;
}

export function BookingRowExpanded({
  visitorEmail,
  visitorPhone,
  reference,
}: BookingRowExpandedProps) {
  return (
    <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-slate-400" />
          <div>
            <p className="text-xs text-slate-500">Email</p>
            <a
              href={`mailto:${visitorEmail}`}
              className="text-sm text-burgundy-600 hover:underline"
            >
              {visitorEmail}
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-slate-400" />
          <div>
            <p className="text-xs text-slate-500">Phone</p>
            <a
              href={`tel:${visitorPhone}`}
              className="text-sm text-burgundy-600 hover:underline"
            >
              {visitorPhone}
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-slate-400" />
          <div>
            <p className="text-xs text-slate-500">Reference</p>
            <p className="font-mono text-sm text-slate-900">{reference}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
