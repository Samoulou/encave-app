'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface NotFoundSearchProps {
  placeholder?: string;
}

export function NotFoundSearch({ placeholder }: NotFoundSearchProps) {
  const t = useTranslations('search');
  const tButtons = useTranslations('common.buttons');
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/experiences?search=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <Search
          className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? t('placeholder')}
          className="h-12 pl-12 text-base"
          aria-label={t('searchExperiencesLabel')}
        />
      </div>
      <Button type="submit" size="lg" className="h-12 px-6">
        <Search className="h-5 w-5 sm:mr-2" aria-hidden="true" />
        <span className="hidden sm:inline">{tButtons('search')}</span>
      </Button>
    </form>
  );
}
