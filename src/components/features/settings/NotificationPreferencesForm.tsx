'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('settings.notifications');
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
        toast.success(t('updated'));
      } else {
        toast.error(result.error?.message || t('updateFailed'));
      }
    } catch {
      toast.error(t('unexpectedError'));
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
                      {t('dailyDigest')}
                    </FormLabel>
                    <FormDescription>
                      {t('dailyDigestDescription')}
                    </FormDescription>
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Daily Digest"
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
                      {t('weeklySummary')}
                    </FormLabel>
                    <FormDescription>
                      {t('weeklySummaryDescription')}
                    </FormDescription>
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Weekly Summary"
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
                      {t('instantAlerts')}
                    </FormLabel>
                    <FormDescription>
                      {t('instantAlertsDescription')}
                    </FormDescription>
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Instant Booking Alerts"
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
                {t('saving')}
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                {t('savePreferences')}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
