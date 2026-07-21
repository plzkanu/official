interface BrandLogoProps {
  variant?: 'default' | 'sidebar';
  className?: string;
}

export default function BrandLogo({ variant = 'default', className = '' }: BrandLogoProps) {
  if (variant === 'sidebar') {
    return (
      <div className={`rounded-lg bg-white px-3 py-2.5 ${className}`}>
        <img
          src="/soosan-logo.png"
          alt="SOOSAN"
          className="h-7 w-auto object-contain object-left"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <img
        src="/soosan-logo.png"
        alt="SOOSAN"
        className="h-12 w-auto max-w-[220px] object-contain"
        draggable={false}
      />
    </div>
  );
}
