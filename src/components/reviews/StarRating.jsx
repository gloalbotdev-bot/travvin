import React from 'react';
import { Star } from 'lucide-react';

export default function StarRating({ value = 0, onChange, size = 24, color = '#F97316' }) {
  return (
    <div className="flex gap-1" dir="ltr">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange && onChange(n)}
          disabled={!onChange}
          style={{ cursor: onChange ? 'pointer' : 'default' }}
        >
          <Star
            size={size}
            fill={n <= value ? color : 'none'}
            style={{ color: n <= value ? color : '#D1D5DB' }}
          />
        </button>
      ))}
    </div>
  );
}