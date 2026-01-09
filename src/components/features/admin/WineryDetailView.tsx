'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">{winery.name}</h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                winery.status === 'PENDING'
                  ? 'bg-amber-100 text-amber-700'
                  : winery.status === 'VERIFIED'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
              }`}
            >
              {winery.status}
            </span>
          </div>
        </div>
        {isPending && (
          <div className="flex gap-2">
            <Button
              onClick={handleApprove}
              disabled={isApproving || isRejecting}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {isApproving ? 'Approving...' : 'Approve'}
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowRejectForm(!showRejectForm)}
              disabled={isApproving || isRejecting}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </div>
        )}
      </div>

      {showRejectForm && isPending && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-lg text-red-700">
              Rejection Reason
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="rejectionReason">
                Please provide a reason for rejection (required)
              </Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this winery registration is being rejected..."
                className="mt-2"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isRejecting || !rejectionReason.trim()}
              >
                {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
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
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-lg text-red-700">
              Rejection Reason
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{winery.rejectionReason}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Winery Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Description</p>
              <p className="mt-1">{winery.description}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-slate-500">
                  <MapPin className="h-4 w-4" />
                  Address
                </p>
                <p className="mt-1">{winery.address}</p>
                <p className="text-slate-600">{winery.commune}</p>
              </div>
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-slate-500">
                  <Phone className="h-4 w-4" />
                  Phone
                </p>
                <p className="mt-1">{winery.phone}</p>
              </div>
            </div>
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <Mail className="h-4 w-4" />
                Winery Email
              </p>
              <p className="mt-1">{winery.email}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Applicant Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Name</p>
              <p className="mt-1">{winery.user.name || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Email</p>
              <p className="mt-1">{winery.user.email}</p>
            </div>
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <Calendar className="h-4 w-4" />
                Registration Date
              </p>
              <p className="mt-1">
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
              <div>
                <p className="text-sm font-medium text-slate-500">Verified At</p>
                <p className="mt-1">
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

      {(winery.coverPhoto || winery.galleryImages.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Photos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {winery.coverPhoto && (
                <div className="relative aspect-video overflow-hidden rounded-lg border">
                  <Image
                    src={winery.coverPhoto}
                    alt="Cover photo"
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  <span className="absolute left-2 top-2 z-10 rounded bg-black/60 px-2 py-1 text-xs text-white">
                    Cover
                  </span>
                </div>
              )}
              {winery.galleryImages.map((image) => (
                <div
                  key={image.id}
                  className="relative aspect-video overflow-hidden rounded-lg border"
                >
                  <Image
                    src={image.url}
                    alt="Gallery image"
                    fill
                    className="object-cover"
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
