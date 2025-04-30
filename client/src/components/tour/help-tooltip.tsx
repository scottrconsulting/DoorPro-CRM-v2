import { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  content: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  className?: string;
  iconSize?: number;
}

/**
 * Help tooltip component that displays help information in a tooltip
 * when hovering over a help icon. Used throughout the application for
 * providing contextual help without cluttering the UI.
 */
const HelpTooltip = ({
  content,
  side = 'top',
  align = 'center',
  className = '',
  iconSize = 16
}: HelpTooltipProps) => {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild className={className}>
          <span className="cursor-help inline-flex">
            <HelpCircle size={iconSize} className="text-muted-foreground" />
          </span>
        </TooltipTrigger>
        <TooltipContent side={side} align={align} className="max-w-xs">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default HelpTooltip;