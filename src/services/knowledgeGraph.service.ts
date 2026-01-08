import type { ResearchFinding, SmartDigest, TimelineEvent } from '@/types';
import type { Node, Edge } from 'reactflow';
import { MarkerType } from 'reactflow';

/**
 * Knowledge Graph Service - Phase 3B Implementation
 * Builds and manages the knowledge graph visualization from research findings
 */

export interface KnowledgeNode {
  id: string;
  type: 'finding' | 'study' | 'treatment' | 'outcome' | 'biomarker' | 'theme' | 'contradiction';
  label: string;
  description?: string;
  properties: Record<string, any>;
  importance: number; // 0-10
  confidence?: number; // 0-1
  sourceIds?: string[]; // References to findings or events
  timestamp?: Date;
}

export interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
  type: 'supports' | 'contradicts' | 'relates_to' | 'derived_from' | 'temporal' | 'causal';
  strength: number; // 0-1
  label?: string;
  metadata?: {
    confidence?: number;
    studies?: string[];
    description?: string;
  };
}

export interface GraphFilter {
  nodeTypes?: string[];
  minImportance?: number;
  minEdgeStrength?: number;
  dateRange?: [Date, Date];
  searchQuery?: string;
  showOnlyConnected?: boolean;
}

// React Flow node/edge types
export interface FlowNode extends Node {
  data: {
    node: KnowledgeNode;
    isHighlighted?: boolean;
    isSelected?: boolean;
  };
}

export interface FlowEdge extends Edge {
  data?: {
    edge: KnowledgeEdge;
  };
}

class KnowledgeGraphService {
  private nodes: Map<string, KnowledgeNode> = new Map();
  private edges: Map<string, KnowledgeEdge> = new Map();

  /**
   * Build knowledge graph from findings and digest
   */
  buildGraph(
    findings: ResearchFinding[],
    digest: SmartDigest | null,
    timeline: TimelineEvent[] = []
  ): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    this.nodes.clear();
    this.edges.clear();

    // Add finding nodes
    findings.forEach(finding => {
      this.addFindingNode(finding);
    });

    // Add theme nodes from digest
    if (digest) {
      this.addThemeNodes(digest);
      this.addContradictionNodes(digest);
      this.addBreakthroughNodes(digest);
    }

    // Add treatment/outcome nodes from timeline
    this.addTimelineNodes(timeline);

    // Detect and add relationships
    this.detectRelationships(findings, digest);

    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values())
    };
  }

  /**
   * Add a finding as a node
   */
  private addFindingNode(finding: ResearchFinding): void {
    const node: KnowledgeNode = {
      id: `finding-${finding.id}`,
      type: 'finding',
      label: finding.title,
      description: finding.summary,
      properties: {
        source: finding.source.name,
        sourceType: finding.source.type,
        relevanceScore: finding.relevanceScore,
        confidenceLevel: finding.confidenceLevel,
        category: finding.category,
        tags: finding.tags || []
      },
      importance: finding.relevanceScore,
      confidence: finding.confidenceLevel / 10,
      sourceIds: [finding.id],
      timestamp: finding.timestamp
    };

    this.nodes.set(node.id, node);

    // Add study node if it's from a study
    if (finding.source.type === 'pubmed' || finding.source.type === 'clinical_trial') {
      this.addStudyNode(finding);
    }
  }

  /**
   * Add a study node
   */
  private addStudyNode(finding: ResearchFinding): void {
    const studyId = `study-${finding.source.name.replace(/[^a-zA-Z0-9]/g, '-')}`;

    if (!this.nodes.has(studyId)) {
      const studyNode: KnowledgeNode = {
        id: studyId,
        type: 'study',
        label: finding.source.name,
        properties: {
          url: finding.source.url,
          type: finding.source.type,
          publishedAt: finding.publishedAt
        },
        importance: 5, // Default importance for studies
        sourceIds: []
      };

      this.nodes.set(studyId, studyNode);
    }

    // Add edge from finding to study
    this.addEdge(
      `finding-${finding.id}`,
      studyId,
      'derived_from',
      0.9,
      'Source study'
    );
  }

  /**
   * Add theme nodes from digest
   */
  private addThemeNodes(digest: SmartDigest): void {
    digest.themes.forEach((theme, index) => {
      const themeId = `theme-${index}`;
      const node: KnowledgeNode = {
        id: themeId,
        type: 'theme',
        label: theme.name,
        description: theme.description,
        properties: {
          prevalence: theme.prevalence,
          findingIds: theme.findingIds
        },
        importance: theme.prevalence >= 0.7 ? 8 : theme.prevalence >= 0.4 ? 6 : 4,
        confidence: theme.prevalence
      };

      this.nodes.set(themeId, node);

      // Connect findings to themes
      theme.findingIds?.forEach(findingId => {
        this.addEdge(
          `finding-${findingId}`,
          themeId,
          'supports',
          theme.prevalence,
          'Part of theme'
        );
      });
    });
  }

  /**
   * Add contradiction nodes from digest
   */
  private addContradictionNodes(digest: SmartDigest): void {
    digest.contradictions.forEach((contradiction, index) => {
      const contradictionId = `contradiction-${index}`;
      const node: KnowledgeNode = {
        id: contradictionId,
        type: 'contradiction',
        label: 'Contradiction',
        description: contradiction.description,
        properties: {
          severity: contradiction.severity,
          resolution: contradiction.resolution,
          findingIds: contradiction.findingIds
        },
        importance: contradiction.severity === 'high' ? 9 : contradiction.severity === 'medium' ? 6 : 3,
        confidence: 0.8
      };

      this.nodes.set(contradictionId, node);

      // Connect contradicting findings
      if (contradiction.findingIds && contradiction.findingIds.length >= 2) {
        for (let i = 0; i < contradiction.findingIds.length - 1; i++) {
          for (let j = i + 1; j < contradiction.findingIds.length; j++) {
            this.addEdge(
              `finding-${contradiction.findingIds[i]}`,
              `finding-${contradiction.findingIds[j]}`,
              'contradicts',
              0.8,
              contradiction.description
            );
          }
        }
      }
    });
  }

  /**
   * Add breakthrough nodes from digest
   */
  private addBreakthroughNodes(digest: SmartDigest): void {
    digest.breakthroughs.forEach((breakthrough, index) => {
      const breakthroughId = `breakthrough-${index}`;
      const node: KnowledgeNode = {
        id: breakthroughId,
        type: 'outcome',
        label: breakthrough.title,
        description: breakthrough.description,
        properties: {
          impact: breakthrough.impact,
          date: breakthrough.date,
          findingIds: breakthrough.findingIds
        },
        importance: breakthrough.impact === 'high' ? 10 : breakthrough.impact === 'medium' ? 7 : 5,
        confidence: breakthrough.confidence || 0.8,
        timestamp: breakthrough.date ? new Date(breakthrough.date) : undefined
      };

      this.nodes.set(breakthroughId, node);

      // Connect related findings
      breakthrough.findingIds?.forEach(findingId => {
        this.addEdge(
          `finding-${findingId}`,
          breakthroughId,
          'supports',
          0.9,
          'Contributes to breakthrough'
        );
      });
    });
  }

  /**
   * Add nodes from timeline events
   */
  private addTimelineNodes(timeline: TimelineEvent[]): void {
    timeline.forEach(event => {
      if (event.type === 'treatment') {
        const treatmentId = `treatment-${event.id}`;
        const node: KnowledgeNode = {
          id: treatmentId,
          type: 'treatment',
          label: event.description,
          description: event.notes,
          properties: {
            date: event.date,
            severity: event.severity,
            tags: event.tags || []
          },
          importance: 6,
          timestamp: event.date
        };

        this.nodes.set(treatmentId, node);
      } else if (event.type === 'outcome' || event.tags?.includes('outcome')) {
        const outcomeId = `outcome-${event.id}`;
        const node: KnowledgeNode = {
          id: outcomeId,
          type: 'outcome',
          label: event.description,
          description: event.notes,
          properties: {
            date: event.date,
            severity: event.severity,
            tags: event.tags || []
          },
          importance: 7,
          timestamp: event.date
        };

        this.nodes.set(outcomeId, node);
      }
    });
  }

  /**
   * Detect relationships between nodes using AI-powered analysis
   */
  private detectRelationships(findings: ResearchFinding[], digest: SmartDigest | null): void {
    // Connect findings with similar categories
    const findingsByCategory = new Map<string, ResearchFinding[]>();
    findings.forEach(finding => {
      const category = finding.category || 'uncategorized';
      if (!findingsByCategory.has(category)) {
        findingsByCategory.set(category, []);
      }
      findingsByCategory.get(category)!.push(finding);
    });

    // Add relationships within categories
    findingsByCategory.forEach((categoryFindings, category) => {
      if (categoryFindings.length >= 2) {
        for (let i = 0; i < categoryFindings.length - 1; i++) {
          for (let j = i + 1; j < categoryFindings.length; j++) {
            const finding1 = categoryFindings[i];
            const finding2 = categoryFindings[j];

            // Calculate relationship strength based on similarity
            const strength = this.calculateRelationshipStrength(finding1, finding2);

            if (strength > 0.3) {
              this.addEdge(
                `finding-${finding1.id}`,
                `finding-${finding2.id}`,
                'relates_to',
                strength,
                `Similar ${category} findings`
              );
            }
          }
        }
      }
    });

    // Add temporal relationships
    const sortedNodes = Array.from(this.nodes.values())
      .filter(n => n.timestamp)
      .sort((a, b) => a.timestamp!.getTime() - b.timestamp!.getTime());

    for (let i = 0; i < sortedNodes.length - 1; i++) {
      const timeDiff = sortedNodes[i + 1].timestamp!.getTime() - sortedNodes[i].timestamp!.getTime();
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

      if (daysDiff <= 7) { // Within a week
        this.addEdge(
          sortedNodes[i].id,
          sortedNodes[i + 1].id,
          'temporal',
          Math.max(0.3, 1 - daysDiff / 7),
          `${Math.round(daysDiff)} days apart`
        );
      }
    }

    // Add causal relationships based on treatment-outcome pairs
    const treatments = Array.from(this.nodes.values()).filter(n => n.type === 'treatment');
    const outcomes = Array.from(this.nodes.values()).filter(n => n.type === 'outcome');

    treatments.forEach(treatment => {
      outcomes.forEach(outcome => {
        if (treatment.timestamp && outcome.timestamp) {
          const timeDiff = outcome.timestamp.getTime() - treatment.timestamp.getTime();
          const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

          if (daysDiff > 0 && daysDiff <= 30) { // Outcome after treatment within 30 days
            this.addEdge(
              treatment.id,
              outcome.id,
              'causal',
              Math.max(0.4, 1 - daysDiff / 30),
              'Potential causal relationship'
            );
          }
        }
      });
    });
  }

  /**
   * Calculate relationship strength between two findings
   */
  private calculateRelationshipStrength(finding1: ResearchFinding, finding2: ResearchFinding): number {
    let strength = 0;

    // Similar relevance scores
    const relevanceDiff = Math.abs(finding1.relevanceScore - finding2.relevanceScore);
    strength += (10 - relevanceDiff) / 10 * 0.3;

    // Similar confidence levels
    const confidenceDiff = Math.abs(finding1.confidenceLevel - finding2.confidenceLevel);
    strength += (10 - confidenceDiff) / 10 * 0.2;

    // Shared tags
    const tags1 = new Set(finding1.tags || []);
    const tags2 = new Set(finding2.tags || []);
    const sharedTags = Array.from(tags1).filter(tag => tags2.has(tag));
    strength += sharedTags.length > 0 ? 0.3 : 0;

    // Same source type
    if (finding1.source.type === finding2.source.type) {
      strength += 0.2;
    }

    return Math.min(1, strength);
  }

  /**
   * Add an edge between nodes
   */
  private addEdge(
    sourceId: string,
    targetId: string,
    type: KnowledgeEdge['type'],
    strength: number,
    label?: string
  ): void {
    if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) {
      return; // Skip if nodes don't exist
    }

    const edgeId = `${sourceId}-${targetId}-${type}`;

    // Check if edge already exists
    if (!this.edges.has(edgeId)) {
      const edge: KnowledgeEdge = {
        id: edgeId,
        source: sourceId,
        target: targetId,
        type,
        strength,
        label,
        metadata: {
          confidence: strength
        }
      };

      this.edges.set(edgeId, edge);
    }
  }

  /**
   * Convert to React Flow format
   */
  toReactFlowElements(
    nodes: KnowledgeNode[],
    edges: KnowledgeEdge[],
    filter?: GraphFilter
  ): { nodes: FlowNode[]; edges: FlowEdge[] } {
    // Apply filters
    let filteredNodes = nodes;
    let filteredEdges = edges;

    if (filter) {
      // Filter nodes
      filteredNodes = nodes.filter(node => {
        if (filter.nodeTypes && !filter.nodeTypes.includes(node.type)) return false;
        if (filter.minImportance && node.importance < filter.minImportance) return false;
        if (filter.dateRange && node.timestamp) {
          if (node.timestamp < filter.dateRange[0] || node.timestamp > filter.dateRange[1]) return false;
        }
        if (filter.searchQuery) {
          const query = filter.searchQuery.toLowerCase();
          if (!node.label.toLowerCase().includes(query) &&
              !node.description?.toLowerCase().includes(query)) return false;
        }
        return true;
      });

      // Filter edges
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      filteredEdges = edges.filter(edge => {
        if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return false;
        if (filter.minEdgeStrength && edge.strength < filter.minEdgeStrength) return false;
        return true;
      });

      // Remove unconnected nodes if requested
      if (filter.showOnlyConnected) {
        const connectedNodeIds = new Set<string>();
        filteredEdges.forEach(edge => {
          connectedNodeIds.add(edge.source);
          connectedNodeIds.add(edge.target);
        });
        filteredNodes = filteredNodes.filter(node => connectedNodeIds.has(node.id));
      }
    }

    // Calculate positions using force-directed layout
    const positions = this.calculateLayout(filteredNodes, filteredEdges);

    // Convert to React Flow nodes
    const flowNodes: FlowNode[] = filteredNodes.map(node => ({
      id: node.id,
      type: this.getNodeType(node.type),
      position: positions.get(node.id) || { x: 0, y: 0 },
      data: {
        node,
        isHighlighted: false,
        isSelected: false
      }
    }));

    // Convert to React Flow edges
    const flowEdges: FlowEdge[] = filteredEdges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: this.getEdgeType(edge.type),
      animated: edge.type === 'causal' || edge.type === 'temporal',
      style: {
        stroke: this.getEdgeColor(edge.type),
        strokeWidth: Math.max(1, edge.strength * 3)
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: this.getEdgeColor(edge.type)
      },
      label: edge.label,
      labelStyle: {
        fontSize: 10
      },
      data: {
        edge
      }
    }));

    return { nodes: flowNodes, edges: flowEdges };
  }

  /**
   * Calculate layout positions using simple force-directed algorithm
   */
  private calculateLayout(
    nodes: KnowledgeNode[],
    edges: KnowledgeEdge[]
  ): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>();
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Group nodes by type
    const nodesByType = new Map<string, KnowledgeNode[]>();
    nodes.forEach(node => {
      if (!nodesByType.has(node.type)) {
        nodesByType.set(node.type, []);
      }
      nodesByType.get(node.type)!.push(node);
    });

    // Arrange nodes in concentric circles by type
    const typeOrder = ['theme', 'contradiction', 'finding', 'study', 'treatment', 'outcome', 'biomarker'];
    let radius = 0;

    typeOrder.forEach(type => {
      const typeNodes = nodesByType.get(type) || [];
      if (typeNodes.length === 0) return;

      radius += 200;
      const angleStep = (2 * Math.PI) / Math.max(1, typeNodes.length);

      typeNodes.forEach((node, index) => {
        const angle = index * angleStep;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        positions.set(node.id, { x, y });
      });
    });

    // Fine-tune positions based on connections
    for (let iteration = 0; iteration < 50; iteration++) {
      const forces = new Map<string, { x: number; y: number }>();

      // Calculate repulsion between all nodes
      nodes.forEach(node1 => {
        let forceX = 0;
        let forceY = 0;

        nodes.forEach(node2 => {
          if (node1.id === node2.id) return;

          const pos1 = positions.get(node1.id)!;
          const pos2 = positions.get(node2.id)!;

          const dx = pos2.x - pos1.x;
          const dy = pos2.y - pos1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > 0) {
            const repulsion = 10000 / (distance * distance);
            forceX -= (dx / distance) * repulsion;
            forceY -= (dy / distance) * repulsion;
          }
        });

        forces.set(node1.id, { x: forceX, y: forceY });
      });

      // Calculate attraction along edges
      edges.forEach(edge => {
        const pos1 = positions.get(edge.source)!;
        const pos2 = positions.get(edge.target)!;

        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
          const attraction = distance * edge.strength * 0.01;

          const force1 = forces.get(edge.source)!;
          force1.x += (dx / distance) * attraction;
          force1.y += (dy / distance) * attraction;

          const force2 = forces.get(edge.target)!;
          force2.x -= (dx / distance) * attraction;
          force2.y -= (dy / distance) * attraction;
        }
      });

      // Apply forces
      nodes.forEach(node => {
        const pos = positions.get(node.id)!;
        const force = forces.get(node.id)!;

        pos.x += force.x * 0.01;
        pos.y += force.y * 0.01;
      });
    }

    return positions;
  }

  /**
   * Get React Flow node type based on knowledge node type
   */
  private getNodeType(type: string): string {
    // Can be customized with custom node components
    switch (type) {
      case 'theme':
      case 'contradiction':
        return 'default';
      default:
        return 'default';
    }
  }

  /**
   * Get React Flow edge type based on knowledge edge type
   */
  private getEdgeType(type: string): string {
    switch (type) {
      case 'contradicts':
        return 'straight';
      case 'causal':
      case 'temporal':
        return 'smoothstep';
      default:
        return 'default';
    }
  }

  /**
   * Get edge color based on type
   */
  private getEdgeColor(type: string): string {
    switch (type) {
      case 'supports':
        return '#10b981'; // green
      case 'contradicts':
        return '#ef4444'; // red
      case 'relates_to':
        return '#6b7280'; // gray
      case 'derived_from':
        return '#3b82f6'; // blue
      case 'temporal':
        return '#8b5cf6'; // purple
      case 'causal':
        return '#f59e0b'; // amber
      default:
        return '#6b7280'; // gray
    }
  }

  /**
   * Get connected nodes for a given node
   */
  getConnectedNodes(nodeId: string, edges: KnowledgeEdge[]): Set<string> {
    const connected = new Set<string>();

    edges.forEach(edge => {
      if (edge.source === nodeId) {
        connected.add(edge.target);
      } else if (edge.target === nodeId) {
        connected.add(edge.source);
      }
    });

    return connected;
  }

  /**
   * Calculate graph metrics
   */
  getGraphMetrics(nodes: KnowledgeNode[], edges: KnowledgeEdge[]): {
    nodeCount: number;
    edgeCount: number;
    avgDegree: number;
    density: number;
    clusters: number;
    centralNodes: string[];
  } {
    const nodeCount = nodes.length;
    const edgeCount = edges.length;

    // Calculate average degree
    const degrees = new Map<string, number>();
    edges.forEach(edge => {
      degrees.set(edge.source, (degrees.get(edge.source) || 0) + 1);
      degrees.set(edge.target, (degrees.get(edge.target) || 0) + 1);
    });

    const avgDegree = nodeCount > 0
      ? Array.from(degrees.values()).reduce((sum, d) => sum + d, 0) / nodeCount
      : 0;

    // Calculate density
    const maxEdges = (nodeCount * (nodeCount - 1)) / 2;
    const density = maxEdges > 0 ? edgeCount / maxEdges : 0;

    // Find central nodes (high degree)
    const centralNodes = Array.from(degrees.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    // Simple cluster detection (connected components)
    const visited = new Set<string>();
    let clusters = 0;

    const dfs = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      edges.forEach(edge => {
        if (edge.source === nodeId && !visited.has(edge.target)) {
          dfs(edge.target);
        } else if (edge.target === nodeId && !visited.has(edge.source)) {
          dfs(edge.source);
        }
      });
    };

    nodes.forEach(node => {
      if (!visited.has(node.id)) {
        clusters++;
        dfs(node.id);
      }
    });

    return {
      nodeCount,
      edgeCount,
      avgDegree,
      density,
      clusters,
      centralNodes
    };
  }
}

export const knowledgeGraphService = new KnowledgeGraphService();