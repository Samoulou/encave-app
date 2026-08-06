'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { MapPin, Loader2, X, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    house_number?: string;
    road?: string;
    village?: string;
    town?: string;
    city?: string;
    municipality?: string;
    postcode?: string;
    country?: string;
  };
}

interface AddressData {
  street: string;
  city: string;
  zipCode: string;
  latitude: number | null;
  longitude: number | null;
  fullAddress: string;
}

interface AddressAutocompleteProps {
  value: AddressData;
  onChange: (_data: AddressData) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Search for an address...',
  className,
  id,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value.fullAddress || '');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [noResults, setNoResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchAddress = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setSuggestions([]);
      setNoResults(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setNoResults(false);

    try {
      // Use server-side proxy to avoid CORS and User-Agent issues
      const response = await fetch(
        `/api/geocode/search?q=${encodeURIComponent(searchQuery)}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        setSuggestions(data);
        setIsOpen(data.length > 0);
        setNoResults(data.length === 0);
        setSelectedIndex(-1);
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        setSuggestions([]);
        setNoResults(true);
      }
    } catch (err) {
      console.error('Address search error:', err);
      setSuggestions([]);
      setError(
        'Unable to search addresses. Please try again or enter manually.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce search to avoid too many API calls
    debounceRef.current = setTimeout(() => {
      searchAddress(newQuery);
    }, 300);
  };

  const handleSelectSuggestion = (result: NominatimResult) => {
    const address = result.address || {};
    const street = [address.road, address.house_number]
      .filter(Boolean)
      .join(' ');
    const city =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      '';
    const zipCode = address.postcode || '';

    const addressData: AddressData = {
      street,
      city,
      zipCode,
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      fullAddress: result.display_name,
    };

    setQuery(result.display_name);
    setSuggestions([]);
    setIsOpen(false);
    onChange(addressData);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setError(null);
    setNoResults(false);
    onChange({
      street: '',
      city: '',
      zipCode: '',
      latitude: null,
      longitude: null,
      fullAddress: '',
    });
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          id={id}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="h-12 border-stone-200 bg-muted pl-10 pr-10"
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {!isLoading && query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg">
          {suggestions.map((result, index) => (
            <button
              key={result.place_id}
              type="button"
              className={cn(
                'flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50',
                index === selectedIndex && 'bg-slate-50',
                index !== suggestions.length - 1 && 'border-b border-stone-100'
              )}
              onClick={() => handleSelectSuggestion(result)}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="line-clamp-2 text-foreground">
                {result.display_name}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {noResults && !isLoading && query.length >= 3 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-stone-200 bg-white p-4 shadow-lg">
          <p className="text-center text-sm text-muted-foreground">
            No addresses found. Try a different search or enter the address
            manually below.
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-2 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
