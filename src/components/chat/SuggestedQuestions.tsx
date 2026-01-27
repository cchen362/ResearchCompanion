import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/utils/cn';

interface SuggestedQuestionsProps {
  questions: string[];
  onQuestionClick: (question: string) => void;
  className?: string;
  autoHideDelay?: number; // milliseconds, 0 to disable
}

export function SuggestedQuestions({
  questions,
  onQuestionClick,
  className,
  autoHideDelay = 10000 // Default 10 seconds
}: SuggestedQuestionsProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoHideTimerRef = useRef<NodeJS.Timeout>();

  // Check scroll position to show/hide arrows
  const checkScrollPosition = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  // Auto-hide functionality
  useEffect(() => {
    if (autoHideDelay > 0 && !isHovered) {
      autoHideTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, autoHideDelay);
    }

    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
    };
  }, [autoHideDelay, isHovered]);

  // Check scroll arrows on mount and window resize
  useEffect(() => {
    checkScrollPosition();
    window.addEventListener('resize', checkScrollPosition);
    return () => window.removeEventListener('resize', checkScrollPosition);
  }, [questions]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleQuestionClick = (question: string) => {
    onQuestionClick(question);
    setIsVisible(false); // Hide after selection
  };

  if (!questions || questions.length === 0 || !isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        "relative flex items-center gap-2 px-4 py-2 animate-float-in",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Sparkles Icon */}
      <div className="flex-shrink-0">
        <Sparkles className="w-4 h-4 text-blue-500 animate-pulse-soft" />
      </div>

      {/* Left Arrow */}
      {showLeftArrow && (
        <button
          onClick={() => handleScroll('left')}
          className="flex-shrink-0 p-1 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 hover:bg-gray-50 dark:hover:bg-gray-700/80 transition-all duration-200"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-3 h-3 text-gray-600 dark:text-gray-400" />
        </button>
      )}

      {/* Questions Container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth"
        onScroll={checkScrollPosition}
      >
        {questions.map((question, index) => (
          <button
            key={index}
            onClick={() => handleQuestionClick(question)}
            className={cn(
              "flex-shrink-0 text-xs px-3 py-1.5",
              "bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm",
              "border border-gray-200/60 dark:border-gray-700/60",
              "rounded-full",
              "hover:bg-blue-50 dark:hover:bg-blue-900/20",
              "hover:border-blue-300 dark:hover:border-blue-700",
              "cursor-pointer transition-all duration-200",
              "hover:scale-[1.02] hover:shadow-sm",
              "text-gray-700 dark:text-gray-300",
              "hover:text-blue-700 dark:hover:text-blue-400",
              "animate-slide-up-fade"
            )}
            style={{
              animationDelay: `${index * 50}ms`
            }}
          >
            {question}
          </button>
        ))}
      </div>

      {/* Right Arrow */}
      {showRightArrow && (
        <button
          onClick={() => handleScroll('right')}
          className="flex-shrink-0 p-1 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 hover:bg-gray-50 dark:hover:bg-gray-700/80 transition-all duration-200"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-3 h-3 text-gray-600 dark:text-gray-400" />
        </button>
      )}

      {/* Auto-hide indicator */}
      {autoHideDelay > 0 && !isHovered && (
        <div className="absolute -top-1 right-4">
          <div className="text-[10px] text-gray-400 dark:text-gray-600 animate-pulse">
            auto-hide
          </div>
        </div>
      )}
    </div>
  );
}