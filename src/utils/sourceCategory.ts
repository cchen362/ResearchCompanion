import type { DigestSourceType } from '@/types';

/**
 * Normalize a finding's source.type string into one of the four canonical
 * source categories used throughout the UI.
 *
 * Mapping logic (must stay consistent with digest-processor.service.ts):
 *   'research_article', 'pubmed', 'journal', 'research_paper' → 'pubmed'
 *   'clinical_trial'                                           → 'clinical_trial'
 *   'fda'                                                      → 'fda'
 *   everything else (including 'web_article', undefined)       → 'web'
 */
export function getSourceCategory(sourceType?: string): DigestSourceType {
  const s = (sourceType || '').toLowerCase();

  if (s.includes('pubmed') || s.includes('research') || s.includes('journal') || s === 'academic') {
    return 'pubmed';
  }

  if (s.includes('clinical') || s.includes('trial')) {
    return 'clinical_trial';
  }

  if (s.includes('fda')) {
    return 'fda';
  }

  return 'web';
}
