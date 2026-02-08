import { cn } from '@/lib/utils';

const containerVariants = {
  dashboard: 'max-w-[1440px]',
  grid:      'max-w-[1280px]',
  reading:   'max-w-3xl',
} as const;

type ContainerVariant = keyof typeof containerVariants;

interface ContainerProps {
  variant?: ContainerVariant;
  children: React.ReactNode;
  className?: string;
}

export function Container({ variant = 'grid', children, className }: ContainerProps) {
  return (
    <div
      className={cn('mx-auto w-full', containerVariants[variant], className)}
      style={{ paddingInline: 'clamp(1rem, 4vw, 3rem)' }}
    >
      {children}
    </div>
  );
}
