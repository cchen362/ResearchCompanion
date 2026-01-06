import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => onOpenChange(false)}
      />
      {/* Sheet */}
      <div className="fixed inset-y-0 right-0 z-50">
        {children}
      </div>
    </>
  );
}

interface SheetContentProps {
  className?: string;
  children: React.ReactNode;
}

export function SheetContent({ className = '', children }: SheetContentProps) {
  return (
    <div className={`bg-white h-full shadow-xl ${className}`}>
      {children}
    </div>
  );
}

interface SheetHeaderProps {
  className?: string;
  children: React.ReactNode;
}

export function SheetHeader({ className = '', children }: SheetHeaderProps) {
  return (
    <div className={`p-6 border-b ${className}`}>
      {children}
    </div>
  );
}

interface SheetTitleProps {
  className?: string;
  children: React.ReactNode;
}

export function SheetTitle({ className = '', children }: SheetTitleProps) {
  return (
    <h2 className={`text-lg font-semibold ${className}`}>
      {children}
    </h2>
  );
}

interface SheetDescriptionProps {
  className?: string;
  children: React.ReactNode;
}

export function SheetDescription({ className = '', children }: SheetDescriptionProps) {
  return (
    <p className={`text-sm text-gray-500 mt-1 ${className}`}>
      {children}
    </p>
  );
}