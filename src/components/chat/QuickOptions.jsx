import React from 'react';

export default function QuickOptions({ options, onSelect }) {
  if (!options || options.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2 mb-1 justify-start pr-10">
      {options.map((opt, i) => (
        <button
          key={i}
          onClick={() => onSelect(opt.text)}
          className="bg-white border border-[#25D366] text-[#075E54] text-xs font-medium px-3 py-1.5 rounded-full shadow-sm hover:bg-[#25D366] hover:text-white transition-colors whitespace-nowrap"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}