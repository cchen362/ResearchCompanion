import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import type { ResearchFinding, SmartDigest, ResearchTopic } from '@/types';
import { researchInsightsService } from './researchInsights.service';

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
    digest: SmartDigest | null
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

    // Research Insights Summary
    if (topic && findings.length > 0) {
      yPosition += 20;
      pdf.setFontSize(16);
      pdf.setTextColor(...primaryColor);
      pdf.text('Research Overview', 20, yPosition);

      yPosition += 10;

      // Calculate metrics (pass topic as array since the method expects topics array)
      const metrics = await researchInsightsService.calculateResearchMetrics(findings, [topic]);

      pdf.setFontSize(11);
      pdf.setTextColor(...textColor);

      // Key metrics
      const metricsText = [
        `Total Findings: ${metrics.totalFindings}`,
        `Unique Sources: ${metrics.uniqueSources}`,
        `Findings per week: ${metrics.findingsPerWeek || 0}`,
        `Research Duration: ${metrics.researchDuration?.days || 0} days`
      ];

      metricsText.forEach(text => {
        pdf.text(text, 25, yPosition);
        yPosition += 7;
      });

      // Source breakdown if available
      if (metrics.sourceDistribution.length > 0) {
        yPosition += 5;
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'bold');
        pdf.text('Top Research Sources:', 25, yPosition);
        pdf.setFont(undefined, 'normal');
        yPosition += 6;

        metrics.sourceDistribution.slice(0, 5).forEach(source => {
          pdf.setFontSize(9);
          pdf.text(`• ${source.source}: ${source.count} findings`, 30, yPosition);
          yPosition += 5;
        });
      }
    }

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

      // Note: Removed Key Themes section as the theme structure has changed
      // and may not have simple name/description fields anymore

      // Contradictions - simplified to avoid missing field issues
      if (digest.contradictions && digest.contradictions.length > 0) {
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
          const contradictionText = `• ${contradiction.topic}: "${contradiction.findingA?.claim || 'Finding A'}" vs "${contradiction.findingB?.claim || 'Finding B'}"`;
          yPosition += addWrappedText(contradictionText, 25, yPosition, 165);
          yPosition += 3;
        });
      }

      // Breakthroughs - with safety checks for fields
      if (digest.breakthroughs && digest.breakthroughs.length > 0) {
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
          const breakthroughText = breakthrough.title && breakthrough.description
            ? `• ${breakthrough.title}: ${breakthrough.description}`
            : `• ${breakthrough.title || breakthrough.description || 'Breakthrough finding'}`;
          yPosition += addWrappedText(breakthroughText, 25, yPosition, 165);
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

    // Helper function to render a finding with safety checks
    const renderFinding = (finding: ResearchFinding) => {
      if (yPosition > 240) {
        pdf.addPage();
        yPosition = 20;
      }

      // Title
      pdf.setFontSize(12);
      pdf.setTextColor(...textColor);
      pdf.setFont(undefined, 'bold');
      pdf.text(finding.title || 'Untitled Finding', 25, yPosition);
      pdf.setFont(undefined, 'normal');
      yPosition += 7;

      // Details or Summary
      pdf.setFontSize(10);
      const content = finding.details && finding.details !== finding.summary
        ? finding.details
        : finding.summary || '';
      if (content) {
        yPosition += addWrappedText(content, 25, yPosition, 165);
      }

      // Extracted entities if present
      if (finding.extractedEntities && finding.extractedEntities.length > 0) {
        pdf.setFontSize(9);
        pdf.setTextColor(60, 60, 60);
        const entities = finding.extractedEntities
          .map(e => e.dosage ? `${e.name} (${e.dosage})` : e.name)
          .join(', ');
        yPosition += addWrappedText(`Key Items: ${entities}`, 25, yPosition, 165);
      }

      // Metadata - only add if values exist
      const metadata = [];
      if (finding.metadata?.studyType) {
        metadata.push(`Study: ${finding.metadata.studyType}`);
      }
      if (finding.metadata?.participantCount) {
        metadata.push(`N=${finding.metadata.participantCount}`);
      }
      if (finding.metadata?.duration) {
        metadata.push(`Duration: ${finding.metadata.duration}`);
      }

      if (metadata.length > 0) {
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text(metadata.join(' | '), 25, yPosition);
        yPosition += 5;
      }

      // Source and date
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      const sourceName = finding.source?.displayName || finding.source?.name || 'Unknown Source';
      const date = finding.publishedAt || finding.timestamp || new Date();
      pdf.text(`Source: ${sourceName} | ${format(date, 'MMM yyyy')}`, 25, yPosition);
      yPosition += 5;

      // Identifiers if available
      const identifiers = [];
      if (finding.metadata?.doi) identifiers.push(`DOI: ${finding.metadata.doi}`);
      if (finding.metadata?.pmid) identifiers.push(`PMID: ${finding.metadata.pmid}`);
      if (finding.metadata?.nctId) identifiers.push(`NCT: ${finding.metadata.nctId}`);

      if (identifiers.length > 0) {
        pdf.setFontSize(8);
        pdf.text(identifiers.join(' | '), 25, yPosition);
        yPosition += 5;
      }

      yPosition += 8; // Space before next finding
    };

    // Sort all findings by priority and render them
    const priorityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
    const sortedFindings = [...findings].sort((a, b) => {
      const priorityA = priorityOrder[a.priority || 'low'];
      const priorityB = priorityOrder[b.priority || 'low'];
      return priorityA - priorityB;
    });

    // Render all findings using the helper function
    let currentPriority = '';
    sortedFindings.forEach(finding => {
      // Add priority header when it changes
      const priority = finding.priority || 'low';
      if (priority !== currentPriority) {
        if (yPosition > 200) {
          pdf.addPage();
          yPosition = 20;
        }

        currentPriority = priority;
        const priorityLabels = {
          'critical': 'Critical Priority Findings',
          'high': 'High Priority Findings',
          'medium': 'Medium Priority Findings',
          'low': 'Other Findings'
        };

        pdf.setFontSize(13);
        pdf.setTextColor(...primaryColor);
        pdf.text(priorityLabels[priority] || 'Findings', 20, yPosition);
        yPosition += 8;
      }

      renderFinding(finding);
    });


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
   * Creates spreadsheet with findings and analytics data
   */
  async generateExcelExport(
    topic: ResearchTopic,
    findings: ResearchFinding[],
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
    findings: ResearchFinding[]
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
    digest: SmartDigest | null
  ): Promise<void> {
    const blob = await this.generatePDFReport(topic, findings, digest);
    const filename = `${topic.name.replace(/[^a-z0-9]/gi, '_')}_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    this.downloadFile(blob, filename);
  }

  /**
   * Export findings as Excel
   */
  async exportAsExcel(
    topic: ResearchTopic,
    findings: ResearchFinding[],
    digest: SmartDigest | null = null
  ): Promise<void> {
    const blob = await this.generateExcelExport(topic, findings, digest);
    const filename = `${topic.name.replace(/[^a-z0-9]/gi, '_')}_data_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    this.downloadFile(blob, filename);
  }

  /**
   * Export findings as FHIR JSON
   */
  async exportAsFHIR(
    topic: ResearchTopic,
    findings: ResearchFinding[]
  ): Promise<void> {
    const json = await this.generateFHIRExport(topic, findings);
    const blob = new Blob([json], { type: 'application/json' });
    const filename = `${topic.name.replace(/[^a-z0-9]/gi, '_')}_fhir_${format(new Date(), 'yyyy-MM-dd')}.json`;
    this.downloadFile(blob, filename);
  }
}

export const exportService = new ExportService();