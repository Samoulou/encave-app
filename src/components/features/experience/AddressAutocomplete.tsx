'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';
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
  onChange: (address: AddressData) => void;
  placeholder?: string;
  className?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Search for an address...',
  className,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value.fullAddress || '');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchAddress = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      // Add Switzerland context for better results
      const searchWithContext = searchQuery.includes('Switzerland')
        ? searchQuery
        : `${searchQuery}, Valais, Switzerland`;

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
          new URLSearchParams({
            q: searchWithContext,
            format: 'json',
            limit: '5',
            addressdetails: '1',
            countrycodes: 'ch',
          }),
        {
          headers: {
            'User-Agent': 'EnCave/1.0 (https://encave.ch)',
          },
        }
      );

      if (response.ok) {
        const data = (await response.json()) as NominatimResult[];
        setSuggestions(data);
        setIsOpen(data.length > 0);
        setSelectedIndex(-1);
      }
    } catch (error) {
      console.error('Address search error:', error);
      setSuggestions([]);
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
    const street = [address.road, address.house_number].filter(Boolean).join(' ');
    const city = address.city || address.town || address.village || address.municipality || '';
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
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
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
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="bg-slate-50 border-stone-200 h-12 pl-10 pr-10"
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />
        )}
        {!isLoading && query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((result, index) => (
            <button
              key={result.place_id}
              type="button"
              className={cn(
                'w-full px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors flex items-start gap-3',
                index === selectedIndex && 'bg-slate-50',
                index !== suggestions.length - 1 && 'border-b border-stone-100'
              )}
              onClick={() => handleSelectSuggestion(result)}
            >
              <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span className="text-slate-700 line-clamp-2">{result.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
