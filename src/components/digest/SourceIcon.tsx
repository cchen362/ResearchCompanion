import React from 'react';
import { BookOpen, FlaskConical, Shield, Globe } from 'lucide-react';
import type { DigestSourceType } from '@/types';

interface SourceIconProps {
  type: DigestSourceType;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const SOURCE_CONFIG: Record<DigestSourceType, {
  icon: typeof BookOpen;
  color: string;
  bgColor: string;
  label: string;
}> = {
  pubmed: {
    icon: BookOpen,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'PubMed',
  },
  clinical_trial: {
    icon: FlaskConical,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Clinical Trial',
  },
  fda: {
    icon: Shield,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    label: 'FDA',
  },
  web: {
    icon: Globe,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    label: 'Web',
  },
};

const SIZE_MAP = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

export function SourceIcon({ type, size = 'md', showLabel = false, className = '' }: SourceIconProps) {
  const config = SOURCE_CONFIG[type];
  const Icon = config.icon;

  if (showLabel) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <span className={`p-1 rounded ${config.bgColor}`}>
          <Icon className={`${SIZE_MAP[size]} ${config.color}`} />
        </span>
        <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
      </span>
    );
  }

  return (
    <Icon className={`${SIZE_MAP[size]} ${config.color} ${className}`} />
  );
}

export { SOURCE_CONFIG };
