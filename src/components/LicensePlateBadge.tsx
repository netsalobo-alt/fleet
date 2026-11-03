import React from 'react';

interface LicensePlateBadgeProps {
  placa: string;
  size?: 'sm' | 'md' | 'lg';
  highlightLastDigits?: boolean;
}

export const LicensePlateBadge: React.FC<LicensePlateBadgeProps> = ({
  placa,
  size = 'md',
  highlightLastDigits = false,
}) => {
  const cleanPlaca = (placa || 'ABC-1234').toUpperCase();

  // Highlight last 2 digits for DETRAN-PA reference
  const digitsOnly = cleanPlaca.replace(/[^0-9]/g, '');
  const last2 = digitsOnly.length >= 2 ? digitsOnly.slice(-2) : '01';

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 min-w-[76px]',
    md: 'text-xs px-2.5 py-1 min-w-[92px]',
    lg: 'text-sm px-3.5 py-1.5 min-w-[110px]',
  };

  return (
    <div
      className={`inline-flex flex-col border border-slate-300 rounded shadow-sm bg-white overflow-hidden font-mono font-bold tracking-wider select-none ${sizeClasses[size]}`}
    >
      {/* Top Blue Mercosul Ribbon */}
      <div className="bg-[#003399] -mx-4 -mt-1 px-2 py-0.5 flex items-center justify-between text-[8px] text-white font-sans uppercase font-bold tracking-tighter">
        <span>BRASIL</span>
        <div className="flex items-center gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block"></span>
          <span className="text-[7px] text-yellow-300">PA</span>
        </div>
      </div>

      {/* Main Plate Text */}
      <div className="flex items-center justify-center pt-0.5 text-slate-900 font-extrabold tracking-widest">
        {highlightLastDigits ? (
          <>
            <span>{cleanPlaca.slice(0, cleanPlaca.length - 2)}</span>
            <span className="text-blue-700 bg-blue-100/80 px-0.5 rounded border border-blue-300">
              {cleanPlaca.slice(-2)}
            </span>
          </>
        ) : (
          <span>{cleanPlaca}</span>
        )}
      </div>
    </div>
  );
};
