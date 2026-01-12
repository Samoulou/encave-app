'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Mail, Calendar, TrendingUp, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import {
  notificationPreferencesSchema,
  type NotificationPreferencesInput,
} from '@/lib/validators/notifications';
import { updateNotificationPreferences } from '@/server/actions/notifications';

interface NotificationPreferencesFormProps {
  initialData: {
    dailyDigest: boolean;
    weeklySummary: boolean;
    instantBookingAlerts: boolean;
    unsubscribeToken: string;
  };
}

export function NotificationPreferencesForm({
  initialData,
}: NotificationPreferencesFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<NotificationPreferencesInput>({
    resolver: zodResolver(notificationPreferencesSchema),
    defaultValues: {
      dailyDigest: initialData.dailyDigest,
      weeklySummary: initialData.weeklySummary,
      instantBookingAlerts: initialData.instantBookingAlerts,
    },
  });

  async function onSubmit(data: NotificationPreferencesInput) {
    setIsSubmitting(true);
    try {
      const result = await updateNotificationPreferences(data);

      if (result.success) {
        toast.success('Notification preferences updated');
      } else {
        toast.error(result.error?.message || 'Failed to update preferences');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Daily Digest */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <FormField
            control={form.control}
            name="dailyDigest"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-blue-50 p-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="space-y-1">
                    <FormLabel className="text-base font-medium">
                      Daily Digest
                    </FormLabel>
                    <FormDescription>
                      Receive a summary of today&apos;s and tomorrow&apos;s bookings
                      every morning at 7:00 AM
                    </FormDescription>
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {/* Weekly Summary */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <FormField
            control={form.control}
            name="weeklySummary"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-green-50 p-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="space-y-1">
                    <FormLabel className="text-base font-medium">
                      Weekly Summary
                    </FormLabel>
                    <FormDescription>
                      Receive a summary of last week&apos;s bookings and revenue
                      every Monday morning
                    </FormDescription>
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {/* Instant Booking Alerts */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <FormField
            control={form.control}
            name="instantBookingAlerts"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-amber-50 p-2">
                    <Bell className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="space-y-1">
                    <FormLabel className="text-base font-medium">
                      Instant Booking Alerts
                    </FormLabel>
                    <FormDescription>
                      Receive an email immediately when someone books an experience
                    </FormDescription>
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Save Preferences
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
