'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { MapPin, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  searchLocations,
  getAllLocationsSorted,
  getLocationDisplayName,
  type ValaisLocation,
} from '@/lib/constants/locations';
import { calculateDistance, formatDistance } from '@/lib/geo-utils';

interface LocationAutocompleteProps {
  value: ValaisLocation | null;
  onChange: (_location: ValaisLocation | null) => void;
  placeholder?: string;
  className?: string;
  referenceLocation?: { lat: number; lng: number } | null;
}

export function LocationAutocomplete({
  value,
  onChange,
  placeholder,
  className,
  referenceLocation,
}: LocationAutocompleteProps) {
  const t = useTranslations('search');
  const [inputValue, setInputValue] = useState(
    value ? getLocationDisplayName(value) : ''
  );
  const [suggestions, setSuggestions] = useState<ValaisLocation[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync input value when external value changes
  useEffect(() => {
    if (value) {
      setInputValue(getLocationDisplayName(value));
    } else {
      setInputValue('');
    }
  }, [value]);

  // Handle clicks outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  const handleSearch = useCallback((query: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const results = searchLocations(query, 8);
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setActiveIndex(-1);
    }, 300);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    if (newValue.trim()) {
      handleSearch(newValue);
    } else {
      setSuggestions([]);
      setIsOpen(false);
      if (value) {
        onChange(null);
      }
    }
  };

  const handleSelectLocation = (location: ValaisLocation) => {
    setInputValue(getLocationDisplayName(location));
    onChange(location);
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  };

  const showDefaultSuggestions = () => {
    if (inputValue.trim()) {
      if (suggestions.length > 0) {
        setIsOpen(true);
      }
      return;
    }

    const defaultSuggestions = getAllLocationsSorted();
    setSuggestions(defaultSuggestions);
    setIsOpen(defaultSuggestions.length > 0);
    setActiveIndex(-1);
  };

  const handleClear = () => {
    setInputValue('');
    onChange(null);
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Escape') {
        inputRef.current?.blur();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        const selectedSuggestion = suggestions[activeIndex];
        if (activeIndex >= 0 && selectedSuggestion) {
          handleSelectLocation(selectedSuggestion);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        break;
      case 'Tab':
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeElement = listRef.current.children[
        activeIndex
      ] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  const getDistanceDisplay = (location: ValaisLocation): string | null => {
    if (!referenceLocation) return null;
    const distance = calculateDistance(
      referenceLocation.lat,
      referenceLocation.lng,
      location.latitude,
      location.longitude
    );
    return formatDistance(distance);
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <MapPin
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            showDefaultSuggestions();
          }}
          placeholder={placeholder || t('locationPlaceholder')}
          className="pl-10 pr-8"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="location-suggestions"
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `location-option-${activeIndex}` : undefined
          }
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={t('clearLocation')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul
          ref={listRef}
          id="location-suggestions"
          role="listbox"
          className="absolute z-[1000] mt-1 max-h-60 w-full overflow-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((location, index) => {
            const distance = getDistanceDisplay(location);
            return (
              <li
                key={location.id}
                id={`location-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  'flex cursor-pointer items-center justify-between px-3 py-2 text-sm transition-colors',
                  index === activeIndex
                    ? 'bg-burgundy-50 text-burgundy-900'
                    : 'text-foreground hover:bg-muted'
                )}
                onClick={() => handleSelectLocation(location)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <div className="flex items-center gap-2">
                  <MapPin
                    className={cn(
                      'h-4 w-4 flex-shrink-0',
                      index === activeIndex
                        ? 'text-burgundy-600'
                        : 'text-muted-foreground'
                    )}
                    aria-hidden="true"
                  />
                  <span className="font-medium">{location.name}</span>
                  {location.parentCommune && (
                    <span className="text-muted-foreground">
                      , {location.parentCommune}
                    </span>
                  )}
                </div>
                {distance && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {distance}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
