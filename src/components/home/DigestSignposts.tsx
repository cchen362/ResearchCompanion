import { BookOpen, AlertTriangle, HelpCircle, ArrowRight } from 'lucide-react';

interface DigestSignpost {
  id: string;
  topicId: string;
  topicName: string;
  breakthroughCount: number;
  contradictionCount: number;
  knowledgeGapCount: number;
  createdAt: string;
}

interface DigestSignpostsProps {
  signposts: DigestSignpost[];
  onViewFindings: () => void;
}

export function DigestSignposts({ signposts, onViewFindings }: DigestSignpostsProps) {
  if (signposts.length === 0) return null;

  // Only show signposts that have meaningful content
  const meaningfulSignposts = signposts.filter(
    s => s.breakthroughCount > 0 || s.contradictionCount > 0 || s.knowledgeGapCount > 0
  );

  if (meaningfulSignposts.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">Latest Digest Insights</h3>
        </div>
        <button
          onClick={onViewFindings}
          className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
        >
          Open digests <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-5 grid gap-4 sm:grid-cols-2">
        {meaningfulSignposts.map(signpost => (
          <div key={signpost.id} className="border border-gray-100 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">{signpost.topicName}</h4>
            <div className="space-y-2">
              {signpost.breakthroughCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <BookOpen className="h-4 w-4 text-green-600 shrink-0" />
                  <span>{signpost.breakthroughCount} breakthrough{signpost.breakthroughCount > 1 ? 's' : ''}</span>
                </div>
              )}
              {signpost.contradictionCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>{signpost.contradictionCount} contradiction{signpost.contradictionCount > 1 ? 's' : ''}</span>
                </div>
              )}
              {signpost.knowledgeGapCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <HelpCircle className="h-4 w-4 text-blue-500 shrink-0" />
                  <span>{signpost.knowledgeGapCount} knowledge gap{signpost.knowledgeGapCount > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
            <div className="mt-2 text-xs text-gray-400">
              Updated {new Date(signpost.createdAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
