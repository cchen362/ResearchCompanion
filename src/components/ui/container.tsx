import { cn } from '@/lib/utils';

const containerVariants = {
  dashboard: 'max-w-[1600px]',
  grid:      'max-w-[1400px]',
  reading:   'max-w-4xl',
  wide:      'max-w-[1680px]',
} as const;

type ContainerVariant = keyof typeof containerVariants;

interface ContainerProps {
  variant?: ContainerVariant;
  children: React.ReactNode;
  className?: string;
}

export function Container({ variant = 'grid', children, className }: ContainerProps) {
  const isWideVariant = variant === 'dashboard' || variant === 'wide';
  return (
    <div
      className={cn('mx-auto w-full', containerVariants[variant], className)}
      style={{
        paddingInline: isWideVariant
          ? 'clamp(1.5rem, 5vw, 4rem)'
          : 'clamp(1rem, 4vw, 3rem)'
      }}
    >
      {children}
    </div>
  );
}
