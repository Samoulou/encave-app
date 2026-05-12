'use client';

import { useState, FormEvent } from 'react';
import { Search } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface HeroSearchProps {
  placeholder?: string;
  buttonText?: string;
}

export function HeroSearch({
  placeholder = 'Search wine experiences...',
  buttonText = 'Search',
}: HeroSearchProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/experiences?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/experiences');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-xl">
      <div className="relative flex items-center gap-2 rounded-xl bg-white/95 p-2 shadow-lg backdrop-blur-sm">
        <div className="relative flex-1">
          <Search
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={placeholder}
            className="h-12 border-0 bg-transparent pl-12 pr-4 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
            aria-label={placeholder}
          />
        </div>
        <Button type="submit" size="lg" className="h-12 shrink-0 px-6">
          {buttonText}
        </Button>
      </div>
    </form>
  );
}
