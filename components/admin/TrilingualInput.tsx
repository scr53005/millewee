'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TrilingualInputProps {
  label: string;
  valueFr: string;
  valueEn: string;
  valueLb: string;
  onChangeFr: (v: string) => void;
  onChangeEn: (v: string) => void;
  onChangeLb: (v: string) => void;
  multiline?: boolean;
  required?: boolean;
}

const langs = [
  { key: 'fr', label: 'FR' },
  { key: 'en', label: 'EN' },
  { key: 'lb', label: 'LB' },
] as const;

export function TrilingualInput({
  label,
  valueFr,
  valueEn,
  valueLb,
  onChangeFr,
  onChangeEn,
  onChangeLb,
  multiline = false,
  required = false,
}: TrilingualInputProps) {
  const [activeLang, setActiveLang] = useState<'fr' | 'en' | 'lb'>('fr');

  const values = { fr: valueFr, en: valueEn, lb: valueLb };
  const handlers = { fr: onChangeFr, en: onChangeEn, lb: onChangeLb };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
        <div className="flex gap-0.5 bg-gray-100 rounded-md p-0.5">
          {langs.map((lang) => (
            <button
              key={lang.key}
              type="button"
              onClick={() => setActiveLang(lang.key)}
              className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${
                activeLang === lang.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {lang.label}
              {values[lang.key] ? '' : <span className="text-gray-300 ml-0.5">-</span>}
            </button>
          ))}
        </div>
      </div>
      {multiline ? (
        <textarea
          value={values[activeLang]}
          onChange={(e) => handlers[activeLang](e.target.value)}
          rows={3}
          required={required && activeLang === 'fr'}
          placeholder={activeLang === 'fr' ? `${label} (français)` : `${label} (${activeLang})`}
          className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      ) : (
        <Input
          value={values[activeLang]}
          onChange={(e) => handlers[activeLang](e.target.value)}
          required={required && activeLang === 'fr'}
          placeholder={activeLang === 'fr' ? `${label} (français)` : `${label} (${activeLang})`}
          className="bg-white text-gray-900"
        />
      )}
    </div>
  );
}
