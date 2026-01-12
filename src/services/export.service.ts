import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import type { ResearchFinding, SmartDigest, TimelineEvent, ResearchTopic } from '@/types';

/**
 * Export Service - Phase 3A Implementation
 * Handles data export in multiple formats: PDF, CSV/Excel, FHIR JSON
 */
class ExportService {
  /**
   * Generate PDF Report
   * Creates a professional medical report suitable for doctor consultations
   */
  async generatePDFReport(
    topic: ResearchTopic,
    findings: ResearchFinding[],
    digest: SmartDigest | null,
    timeline: TimelineEvent[] = []
  ): Promise<Blob> {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Configure fonts and colors
    const primaryColor = [41, 98, 255]; // Blue
    const textColor = [30, 30, 30]; // Dark gray
    const lineHeight = 7;
    let yPosition = 20;

    // Helper function to add wrapped text
    const addWrappedText = (text: string, x: number, y: number, maxWidth: number): number => {
      const lines = pdf.splitTextToSize(text, maxWidth);
      pdf.text(lines, x, y);
      return lines.length * lineHeight;
    };

    // Title Page
    pdf.setFontSize(24);
    pdf.setTextColor(...primaryColor);
    pdf.text('Medical Research Report', 105, yPosition, { align: 'center' });

    yPosition += 15;
    pdf.setFontSize(18);
    pdf.setTextColor(...textColor);
    pdf.text(topic.name, 105, yPosition, { align: 'center' });

    yPosition += 10;
    pdf.setFontSize(12);
    pdf.text(`Generated: ${format(new Date(), 'MMMM d, yyyy')}`, 105, yPosition, { align: 'center' });

    // Executive Summary (if digest exists)
    if (digest) {
      yPosition += 20;
      pdf.setFontSize(16);
      pdf.setTextColor(...primaryColor);
      pdf.text('Executive Summary', 20, yPosition);

      yPosition += 10;
      pdf.setFontSize(11);
      pdf.setTextColor(...textColor);
      yPosition += addWrappedText(digest.executiveSummary, 20, yPosition, 170);

      // Key Themes
      if (digest.themes.length > 0) {
        yPosition += 15;
        pdf.setFontSize(14);
        pdf.setTextColor(...primaryColor);
        pdf.text('Key Themes', 20, yPosition);

        yPosition += 8;
        pdf.setFontSize(11);
        pdf.setTextColor(...textColor);
        digest.themes.forEach(theme => {
          if (yPosition > 270) {
            pdf.addPage();
            yPosition = 20;
          }
          pdf.text(`• ${theme.name}: ${theme.description}`, 25, yPosition);
          yPosition += 7;
        });
      }

      // Contradictions
      if (digest.contradictions.length > 0) {
        yPosition += 10;
        pdf.setFontSize(14);
        pdf.setTextColor(...primaryColor);
        pdf.text('Important Contradictions', 20, yPosition);

        yPosition += 8;
        pdf.setFontSize(11);
        pdf.setTextColor(...textColor);
        digest.contradictions.forEach(contradiction => {
          if (yPosition > 270) {
            pdf.addPage();
            yPosition = 20;
          }
          yPosition += addWrappedText(
            `• ${contradiction.description}`,
            25,
            yPosition,
            165
          );
          yPosition += 3;
        });
      }

      // Breakthroughs
      if (digest.breakthroughs.length > 0) {
        yPosition += 10;
        pdf.setFontSize(14);
        pdf.setTextColor(...primaryColor);
        pdf.text('Recent Breakthroughs', 20, yPosition);

        yPosition += 8;
        pdf.setFontSize(11);
        pdf.setTextColor(...textColor);
        digest.breakthroughs.forEach(breakthrough => {
          if (yPosition > 270) {
            pdf.addPage();
            yPosition = 20;
          }
          yPosition += addWrappedText(
            `• ${breakthrough.title}: ${breakthrough.description}`,
            25,
            yPosition,
            165
          );
          yPosition += 3;
        });
      }
    }

    // Research Findings
    pdf.addPage();
    yPosition = 20;
    pdf.setFontSize(16);
    pdf.setTextColor(...primaryColor);
    pdf.text('Research Findings', 20, yPosition);

    yPosition += 10;

    // Group findings by priority instead of deprecated relevanceScore
    const criticalFindings = findings.filter(f => f.priority === 'critical');
    const highPriorityFindings = findings.filter(f => f.priority === 'high');
    const otherFindings = findings.filter(f => f.priority !== 'critical' && f.priority !== 'high');

    // Critical findings
    if (criticalFindings.length > 0) {
      pdf.setFontSize(13);
      pdf.setTextColor(...primaryColor);
      pdf.text('Critical Priority Findings', 20, yPosition);
      yPosition += 8;

      criticalFindings.forEach(finding => {
        if (yPosition > 260) {
          pdf.addPage();
          yPosition = 20;
        }

        pdf.setFontSize(12);
        pdf.setTextColor(...textColor);
        pdf.setFont(undefined, 'bold');
        pdf.text(finding.title, 25, yPosition);
        pdf.setFont(undefined, 'normal');
        yPosition += 7;

        pdf.setFontSize(10);
        yPosition += addWrappedText(finding.summary, 25, yPosition, 165);

        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text(
          `Source: ${finding.source.name} | ${format(finding.publishedAt || finding.timestamp, 'MMM yyyy')}`,
          25,
          yPosition
        );
        yPosition += 10;
      });
    }

    // High priority findings
    if (highPriorityFindings.length > 0) {
      if (yPosition > 200) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.setFontSize(13);
      pdf.setTextColor(...primaryColor);
      pdf.text('High Priority Findings', 20, yPosition);
      yPosition += 8;

      highPriorityFindings.forEach(finding => {
        if (yPosition > 260) {
          pdf.addPage();
          yPosition = 20;
        }

        pdf.setFontSize(12);
        pdf.setTextColor(...textColor);
        pdf.setFont(undefined, 'bold');
        pdf.text(finding.title, 25, yPosition);
        pdf.setFont(undefined, 'normal');
        yPosition += 7;

        pdf.setFontSize(10);
        yPosition += addWrappedText(finding.summary, 25, yPosition, 165);

        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text(
          `Source: ${finding.source.name} | ${format(finding.publishedAt || finding.timestamp, 'MMM yyyy')}`,
          25,
          yPosition
        );
        yPosition += 10;
      });
    }

    // Other findings
    if (otherFindings.length > 0) {
      if (yPosition > 200) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.setFontSize(13);
      pdf.setTextColor(...primaryColor);
      pdf.text('Other Findings', 20, yPosition);
      yPosition += 8;

      otherFindings.forEach(finding => {
        if (yPosition > 260) {
          pdf.addPage();
          yPosition = 20;
        }

        pdf.setFontSize(12);
        pdf.setTextColor(...textColor);
        pdf.setFont(undefined, 'bold');
        pdf.text(finding.title, 25, yPosition);
        pdf.setFont(undefined, 'normal');
        yPosition += 7;

        pdf.setFontSize(10);
        yPosition += addWrappedText(finding.summary, 25, yPosition, 165);

        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text(
          `Source: ${finding.source.name} | ${format(finding.publishedAt || finding.timestamp, 'MMM yyyy')}`,
          25,
          yPosition
        );
        yPosition += 10;
      });
    }

    // Timeline Events (if any)
    if (timeline.length > 0) {
      pdf.addPage();
      yPosition = 20;
      pdf.setFontSize(16);
      pdf.setTextColor(...primaryColor);
      pdf.text('Timeline', 20, yPosition);

      yPosition += 10;
      pdf.setFontSize(11);
      pdf.setTextColor(...textColor);

      timeline.forEach(event => {
        if (yPosition > 270) {
          pdf.addPage();
          yPosition = 20;
        }

        pdf.text(
          `${format(event.date, 'MMM d, yyyy')} - ${event.type}: ${event.description}`,
          25,
          yPosition
        );
        yPosition += 7;
      });
    }

    // Footer on last page
    const pageCount = pdf.getNumberOfPages();
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      'Generated by Medical Companion PWA',
      105,
      290,
      { align: 'center' }
    );

    // Return as Blob
    return pdf.output('blob');
  }

  /**
   * Generate CSV/Excel Export
   * Creates spreadsheet with findings, timeline, and analytics data
   */
  async generateExcelExport(
    topic: ResearchTopic,
    findings: ResearchFinding[],
    timeline: TimelineEvent[] = [],
    digest: SmartDigest | null = null
  ): Promise<Blob> {
    const workbook = XLSX.utils.book_new();

    // Findings Sheet
    const findingsData = findings.map(finding => ({
      'Title': finding.title,
      'Summary': finding.summary,
      'Details': finding.details,
      'Source': finding.source.name,
      'Source Type': finding.source.type,
      'Priority': finding.priority || 'medium',
      'Published Date': finding.publishedAt ? format(finding.publishedAt, 'yyyy-MM-dd') : '',
      'Added Date': format(finding.timestamp, 'yyyy-MM-dd HH:mm'),
      'Category': finding.category || '',
      'Tags': finding.tags?.join(', ') || ''
    }));

    const findingsSheet = XLSX.utils.json_to_sheet(findingsData);
    XLSX.utils.book_append_sheet(workbook, findingsSheet, 'Research Findings');

    // Timeline Sheet
    if (timeline.length > 0) {
      const timelineData = timeline.map(event => ({
        'Date': format(event.date, 'yyyy-MM-dd'),
        'Type': event.type,
        'Description': event.description,
        'Severity': event.severity || '',
        'Notes': event.notes || ''
      }));

      const timelineSheet = XLSX.utils.json_to_sheet(timelineData);
      XLSX.utils.book_append_sheet(workbook, timelineSheet, 'Timeline');
    }

    // Digest Summary Sheet
    if (digest) {
      const summaryData = [
        { 'Field': 'Executive Summary', 'Value': digest.executiveSummary },
        { 'Field': 'Total Findings', 'Value': String(digest.statistics.totalFindings) },
        { 'Field': 'Consensus Level', 'Value': `${digest.statistics.consensusLevel}/10` },
        { 'Field': 'Average Evidence Quality', 'Value': `${digest.statistics.averageEvidenceQuality}/10` },
        { 'Field': 'Knowledge Gaps', 'Value': digest.knowledgeGaps.join('; ') },
        { 'Field': 'Next Steps', 'Value': digest.nextSteps.join('; ') }
      ];

      // Add themes
      digest.themes.forEach((theme, index) => {
        summaryData.push({
          'Field': `Theme ${index + 1}`,
          'Value': `${theme.name}: ${theme.description}`
        });
      });

      // Add breakthroughs
      digest.breakthroughs.forEach((breakthrough, index) => {
        summaryData.push({
          'Field': `Breakthrough ${index + 1}`,
          'Value': `${breakthrough.title}: ${breakthrough.description}`
        });
      });

      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    }

    // Write to buffer
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /**
   * Generate FHIR-Compatible JSON
   * Creates healthcare-standard format for EHR integration
   */
  async generateFHIRExport(
    topic: ResearchTopic,
    findings: ResearchFinding[],
    timeline: TimelineEvent[] = []
  ): Promise<string> {
    // FHIR Bundle structure
    const fhirBundle = {
      resourceType: 'Bundle',
      type: 'document',
      timestamp: new Date().toISOString(),
      entry: [
        {
          resource: {
            resourceType: 'Composition',
            status: 'final',
            type: {
              coding: [{
                system: 'http://loinc.org',
                code: '34133-9',
                display: 'Summary of episode note'
              }]
            },
            subject: {
              reference: 'Patient/example',
              display: topic.name
            },
            date: new Date().toISOString(),
            title: `Medical Research Summary: ${topic.name}`,
            section: []
          }
        }
      ]
    };

    // Add findings as Observation resources
    findings.forEach(finding => {
      const observation = {
        resourceType: 'Observation',
        id: finding.id,
        status: 'final',
        code: {
          text: finding.title
        },
        effectiveDateTime: finding.publishedAt?.toISOString() || finding.timestamp.toISOString(),
        valueString: finding.summary,
        note: [{
          text: finding.details
        }],
        interpretation: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
            code: finding.priority === 'critical' || finding.priority === 'high' ? 'H' : finding.priority === 'low' ? 'L' : 'N',
            display: finding.priority === 'critical' || finding.priority === 'high' ? 'High' : finding.priority === 'low' ? 'Low' : 'Normal'
          }]
        }],
        performer: [{
          display: finding.source.name
        }]
      };

      fhirBundle.entry.push({ resource: observation });

      // Add reference to composition
      fhirBundle.entry[0].resource.section.push({
        title: 'Research Finding',
        entry: [{
          reference: `Observation/${finding.id}`
        }]
      });
    });

    // Add timeline events as Condition or Procedure resources
    timeline.forEach(event => {
      if (event.type === 'symptom') {
        const condition = {
          resourceType: 'Condition',
          id: event.id,
          clinicalStatus: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
              code: 'active'
            }]
          },
          verificationStatus: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
              code: 'provisional'
            }]
          },
          code: {
            text: event.description
          },
          subject: {
            reference: 'Patient/example'
          },
          onsetDateTime: event.date.toISOString(),
          severity: event.severity ? {
            coding: [{
              system: 'http://snomed.info/sct',
              code: event.severity === 'severe' ? '24484000' : event.severity === 'moderate' ? '6736007' : '255604002',
              display: event.severity
            }]
          } : undefined
        };

        fhirBundle.entry.push({ resource: condition });
      } else if (event.type === 'treatment') {
        const procedure = {
          resourceType: 'Procedure',
          id: event.id,
          status: 'completed',
          code: {
            text: event.description
          },
          subject: {
            reference: 'Patient/example'
          },
          performedDateTime: event.date.toISOString(),
          note: event.notes ? [{
            text: event.notes
          }] : undefined
        };

        fhirBundle.entry.push({ resource: procedure });
      }
    });

    return JSON.stringify(fhirBundle, null, 2);
  }

  /**
   * Download file helper
   */
  downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Export findings as PDF
   */
  async exportAsPDF(
    topic: ResearchTopic,
    findings: ResearchFinding[],
    digest: SmartDigest | null,
    timeline: TimelineEvent[] = []
  ): Promise<void> {
    const blob = await this.generatePDFReport(topic, findings, digest, timeline);
    const filename = `${topic.name.replace(/[^a-z0-9]/gi, '_')}_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    this.downloadFile(blob, filename);
  }

  /**
   * Export findings as Excel
   */
  async exportAsExcel(
    topic: ResearchTopic,
    findings: ResearchFinding[],
    timeline: TimelineEvent[] = [],
    digest: SmartDigest | null = null
  ): Promise<void> {
    const blob = await this.generateExcelExport(topic, findings, timeline, digest);
    const filename = `${topic.name.replace(/[^a-z0-9]/gi, '_')}_data_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    this.downloadFile(blob, filename);
  }

  /**
   * Export findings as FHIR JSON
   */
  async exportAsFHIR(
    topic: ResearchTopic,
    findings: ResearchFinding[],
    timeline: TimelineEvent[] = []
  ): Promise<void> {
    const json = await this.generateFHIRExport(topic, findings, timeline);
    const blob = new Blob([json], { type: 'application/json' });
    const filename = `${topic.name.replace(/[^a-z0-9]/gi, '_')}_fhir_${format(new Date(), 'yyyy-MM-dd')}.json`;
    this.downloadFile(blob, filename);
  }
}

export const exportService = new ExportService();