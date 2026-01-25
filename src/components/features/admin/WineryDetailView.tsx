'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  CheckCircle,
  XCircle,
  MapPin,
  Phone,
  Mail,
  Calendar,
  User,
  Building2,
  ImageIcon,
} from 'lucide-react';
import { approveWinery, rejectWinery } from '@/server/actions/admin';
import type { WineryStatus } from '@prisma/client';

interface WineryDetailViewProps {
  winery: {
    id: string;
    name: string;
    slug: string;
    description: string;
    address: string;
    commune: string;
    phone: string;
    email: string;
    coverPhoto: string | null;
    status: WineryStatus;
    verifiedAt: Date | null;
    rejectionReason: string | null;
    createdAt: Date;
    user: {
      name: string | null;
      email: string;
    };
    galleryImages: { id: string; url: string }[];
  };
}

export function WineryDetailView({ winery }: WineryDetailViewProps) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const isPending = winery.status === 'PENDING';

  async function handleApprove() {
    setIsApproving(true);
    try {
      const result = await approveWinery(winery.id);
      if (result.success) {
        toast.success('Winery approved successfully');
        router.push('/admin/wineries/pending');
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    } finally {
      setIsApproving(false);
      setShowApproveDialog(false);
    }
  }

  async function handleReject() {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setIsRejecting(true);
    try {
      const result = await rejectWinery(winery.id, rejectionReason);
      if (result.success) {
        toast.success('Winery rejected');
        router.push('/admin/wineries/pending');
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    } finally {
      setIsRejecting(false);
      setShowRejectDialog(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with name, status, and actions */}
      <Card className="shadow-warm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold text-slate-900">{winery.name}</h2>
              <div className="mt-2 flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                  <MapPin className="h-4 w-4" />
                  {winery.commune}, Valais
                </span>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
                    winery.status === 'PENDING' && 'bg-amber-100 text-amber-700',
                    winery.status === 'VERIFIED' && 'bg-green-100 text-green-700',
                    winery.status === 'REJECTED' && 'bg-red-100 text-red-700'
                  )}
                >
                  {winery.status}
                </span>
              </div>
            </div>
            {isPending && (
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowApproveDialog(true)}
                  disabled={isApproving || isRejecting}
                  className="bg-emerald-600 hover:bg-emerald-700 shadow-md"
                  size="lg"
                >
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectForm(!showRejectForm)}
                  disabled={isApproving || isRejecting}
                  size="lg"
                  className="shadow-md"
                >
                  <XCircle className="mr-2 h-5 w-5" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Approval Confirmation Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Winery</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve <strong>{winery.name}</strong>?
              This will make the winery visible in the public directory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={isApproving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isApproving ? 'Approving...' : 'Yes, Approve'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rejection Confirmation Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Winery</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject <strong>{winery.name}</strong>?
              The applicant will be notified with the provided reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={isRejecting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRejecting ? 'Rejecting...' : 'Yes, Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showRejectForm && isPending && (
        <Card className="border-2 border-red-200 bg-red-50/50 shadow-warm">
          <CardHeader className="border-b border-red-100">
            <CardTitle className="flex items-center gap-2 text-lg text-red-700">
              <XCircle className="h-5 w-5" />
              Rejection Reason
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div>
              <Label htmlFor="rejectionReason" className="text-red-700">
                Please provide a reason for rejection (required)
              </Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this winery registration is being rejected..."
                className="mt-2 border-red-200 focus:border-red-400 focus:ring-red-400/20"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="destructive"
                onClick={() => setShowRejectDialog(true)}
                disabled={isRejecting || !rejectionReason.trim()}
              >
                Confirm Rejection
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectionReason('');
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {winery.status === 'REJECTED' && winery.rejectionReason && (
        <Card className="border-2 border-red-200 bg-red-50/50 shadow-warm">
          <CardHeader className="border-b border-red-100">
            <CardTitle className="flex items-center gap-2 text-lg text-red-700">
              <XCircle className="h-5 w-5" />
              Rejection Reason
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-red-600">{winery.rejectionReason}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Winery Information */}
        <Card className="shadow-warm">
          <CardHeader className="border-b border-stone-100">
            <CardTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-burgundy-100">
                <Building2 className="h-4 w-4 text-burgundy-600" />
              </div>
              <span className="font-display">Winery Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Description</p>
              <p className="mt-2 text-slate-700 leading-relaxed">{winery.description}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-stone-50 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <MapPin className="h-3.5 w-3.5" />
                  Address
                </p>
                <p className="mt-2 font-medium text-slate-900">{winery.address}</p>
                <p className="text-slate-600">{winery.commune}, Valais</p>
              </div>
              <div className="rounded-lg bg-stone-50 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <Phone className="h-3.5 w-3.5" />
                  Phone
                </p>
                <a href={`tel:${winery.phone}`} className="mt-2 block font-medium text-burgundy-700 hover:underline">
                  {winery.phone}
                </a>
              </div>
            </div>
            <div className="rounded-lg bg-stone-50 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Mail className="h-3.5 w-3.5" />
                Winery Email
              </p>
              <a href={`mailto:${winery.email}`} className="mt-2 block font-medium text-burgundy-700 hover:underline">
                {winery.email}
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Applicant Information */}
        <Card className="shadow-warm">
          <CardHeader className="border-b border-stone-100">
            <CardTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                <User className="h-4 w-4 text-slate-600" />
              </div>
              <span className="font-display">Applicant Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="rounded-lg bg-stone-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Name</p>
              <p className="mt-2 font-medium text-slate-900">{winery.user.name || 'Not provided'}</p>
            </div>
            <div className="rounded-lg bg-stone-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Account Email</p>
              <p className="mt-2 font-medium text-slate-900">{winery.user.email}</p>
            </div>
            <div className="rounded-lg bg-stone-50 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Calendar className="h-3.5 w-3.5" />
                Registration Date
              </p>
              <p className="mt-2 font-medium text-slate-900">
                {new Date(winery.createdAt).toLocaleDateString('en-CH', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            {winery.verifiedAt && (
              <div className="rounded-lg bg-green-50 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-green-700">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Verified At
                </p>
                <p className="mt-2 font-medium text-green-900">
                  {new Date(winery.verifiedAt).toLocaleDateString('en-CH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Photos Section */}
      {(winery.coverPhoto || winery.galleryImages.length > 0) && (
        <Card className="shadow-warm">
          <CardHeader className="border-b border-stone-100">
            <CardTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-100">
                <ImageIcon className="h-4 w-4 text-gold-700" />
              </div>
              <span className="font-display">Photos</span>
              <span className="ml-auto text-sm font-normal text-slate-500">
                {(winery.coverPhoto ? 1 : 0) + winery.galleryImages.length} image{(winery.coverPhoto ? 1 : 0) + winery.galleryImages.length !== 1 ? 's' : ''}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {winery.coverPhoto && (
                <div className="group relative aspect-video overflow-hidden rounded-xl border border-stone-200">
                  <Image
                    src={winery.coverPhoto}
                    alt="Cover photo"
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  <span className="absolute left-3 top-3 z-10 rounded-full bg-burgundy-600 px-3 py-1 text-xs font-semibold text-white shadow-md">
                    Cover
                  </span>
                </div>
              )}
              {winery.galleryImages.map((image, index) => (
                <div
                  key={image.id}
                  className="group relative aspect-video overflow-hidden rounded-xl border border-stone-200"
                >
                  <Image
                    src={image.url}
                    alt={`Gallery image ${index + 1}`}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
