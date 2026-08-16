import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';
import type { GeoLocation } from '@/lib/types';

interface LocationSearchProps {
  label?: string;
  placeholder?: string;
  value: GeoLocation | null;
  onChange: (loc: GeoLocation | null) => void;
  icon?: React.ReactNode;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

export function LocationSearch({
  label,
  placeholder = 'Search for a place...',
  value,
  onChange,
  icon,
}: LocationSearchProps) {
  const [query, setQuery] = useState(value?.label ?? '');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value?.label ?? '');
  }, [value]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    if (value && query === value.label) return;

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query
          )}&limit=5&countrycodes=in`,
          { headers: { Accept: 'application/json' } }
        );
        if (res.ok) {
          const data = (await res.json()) as NominatimResult[];
          setResults(data);
          setOpen(true);
        }
      } catch {
        // network error — silently fail
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectResult = (r: NominatimResult) => {
    const loc: GeoLocation = {
      label: r.display_name.split(',').slice(0, 3).join(', '),
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    };
    onChange(loc);
    setQuery(loc.label);
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery('');
    setResults([]);
  };

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-slate-700">{label}</label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        )}
        <input
          type="text"
          className={`w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
            icon ? 'pl-10' : ''
          } ${value ? 'pr-10' : ''}`}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value) onChange(null);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        )}
        {!loading && value && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectResult(r)}
              className="flex w-full items-start gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-emerald-50"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span className="line-clamp-2">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
