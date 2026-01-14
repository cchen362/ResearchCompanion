import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Download, FileText, FileSpreadsheet, FileJson, Loader2 } from 'lucide-react';
import { exportService } from '@/services/export.service';
import type { ResearchTopic, ResearchFinding, SmartDigest, TimelineEvent } from '@/types';
import { useToast } from '@/components/ui/use-toast';

interface ExportMenuProps {
  topic: ResearchTopic;
  findings: ResearchFinding[];
  digest: SmartDigest | null;
  timeline?: TimelineEvent[];
  className?: string;
}

export function ExportMenu({ topic, findings, digest, timeline = [], className }: ExportMenuProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);
  const { toast } = useToast();

  const handleExport = async (format: 'pdf' | 'excel' | 'fhir') => {
    setIsExporting(true);
    setExportingFormat(format);

    try {
      switch (format) {
        case 'pdf':
          await exportService.exportAsPDF(topic, findings, digest, timeline);
          toast({
            title: 'PDF exported successfully',
            description: 'Your medical research report has been downloaded.',
          });
          break;

        case 'excel':
          await exportService.exportAsExcel(topic, findings, timeline, digest);
          toast({
            title: 'Excel file exported successfully',
            description: 'Your research data has been downloaded.',
          });
          break;

        case 'fhir':
          await exportService.exportAsFHIR(topic, findings, timeline);
          toast({
            title: 'FHIR JSON exported successfully',
            description: 'Your medical data has been exported in FHIR format.',
          });
          break;
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: 'Export failed',
        description: 'There was an error exporting your data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={className}
          disabled={isExporting || findings.length === 0}
        >
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Export
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => handleExport('pdf')}
          disabled={isExporting}
          className="cursor-pointer"
        >
          <FileText className="mr-2 h-4 w-4" />
          <span>PDF Report</span>
          {exportingFormat === 'pdf' && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
        </DropdownMenuItem>

        {/* Excel and FHIR JSON exports temporarily disabled - not useful for current use case */}
        {/* Can be re-enabled later if needed by uncommenting the code below */}
        {/*
        <DropdownMenuItem
          onClick={() => handleExport('excel')}
          disabled={isExporting}
          className="cursor-pointer"
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          <span>Excel Spreadsheet</span>
          {exportingFormat === 'excel' && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleExport('fhir')}
          disabled={isExporting}
          className="cursor-pointer"
        >
          <FileJson className="mr-2 h-4 w-4" />
          <span>FHIR JSON</span>
          {exportingFormat === 'fhir' && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
        </DropdownMenuItem>
        */}

        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          {findings.length} finding{findings.length !== 1 ? 's' : ''} will be exported
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}