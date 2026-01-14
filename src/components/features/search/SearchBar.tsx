'use client';

import { useState, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (_value: string) => void;
  placeholder?: string;
  className?: string;
  /** Show loading spinner when server is syncing */
  isPending?: boolean;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search experiences, wineries...',
  className,
  isPending = false,
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const [isTyping, setIsTyping] = useState(false);

  // Sync local state with prop value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounce the onChange callback
  useEffect(() => {
    if (localValue === value) {
      setIsTyping(false);
      return;
    }

    setIsTyping(true);
    const timer = setTimeout(() => {
      setIsTyping(false);
      onChange(localValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [localValue, value, onChange]);

  const handleClear = () => {
    setLocalValue('');
    onChange('');
  };

  // Show spinner when typing (debounce period) or when server is syncing
  const showSpinner = isTyping || isPending;

  return (
    <div className={cn('relative', className)}>
      {showSpinner ? (
        <Loader2
          className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-burgundy-600 animate-spin"
          aria-hidden="true"
        />
      ) : (
        <Search
          className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
      )}
      <Input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'h-12 pl-12 pr-10 text-base transition-colors',
          isTyping && 'border-amber-400 focus:border-amber-400'
        )}
        aria-label="Search experiences"
      />
      {localValue && !showSpinner && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 p-0 hover:bg-slate-100"
          aria-label="Clear search"
        >
          <X className="h-4 w-4 text-slate-500" />
        </Button>
      )}
    </div>
  );
}
