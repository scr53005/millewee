'use client';

interface AvailabilityToggleProps {
  isAvailable: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function AvailabilityToggle({ isAvailable, onToggle, disabled = false }: AvailabilityToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        isAvailable ? 'bg-green-500' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
          isAvailable ? 'translate-x-4.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
