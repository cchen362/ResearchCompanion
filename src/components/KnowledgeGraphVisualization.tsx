import { useState, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  MarkerType,
  BackgroundVariant
} from 'reactflow';
import type {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import {
  Search,
  Filter,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  Info,
  Network,
  Download,
  Settings,
  X,
  ChevronRight,
  Brain,
  Lightbulb,
  AlertTriangle,
  Target,
  FileText,
  Activity,
  Pill
} from 'lucide-react';

import { knowledgeGraphService } from '@/services/knowledgeGraph.service';
import type { ResearchFinding, SmartDigest, TimelineEvent } from '@/types';
import type { KnowledgeNode, KnowledgeEdge, GraphFilter, FlowNode, FlowEdge } from '@/services/knowledgeGraph.service';
import { cn } from '@/lib/utils';

interface KnowledgeGraphVisualizationProps {
  findings: ResearchFinding[];
  digest: SmartDigest | null;
  timeline?: TimelineEvent[];
  onNodeClick?: (nodeId: string, node: KnowledgeNode) => void;
  onNodeDoubleClick?: (nodeId: string, node: KnowledgeNode) => void;
  className?: string;
}

// Custom node component
function CustomNode({ data }: { data: FlowNode['data'] }) {
  const { node, isHighlighted, isSelected } = data;

  const getNodeIcon = () => {
    switch (node.type) {
      case 'theme': return <Brain className="h-4 w-4" />;
      case 'finding': return <FileText className="h-4 w-4" />;
      case 'contradiction': return <AlertTriangle className="h-4 w-4" />;
      case 'treatment': return <Pill className="h-4 w-4" />;
      case 'outcome': return <Target className="h-4 w-4" />;
      case 'breakthrough': return <Lightbulb className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getNodeColor = () => {
    switch (node.type) {
      case 'theme': return 'bg-blue-100 border-blue-300 text-blue-900';
      case 'finding': return 'bg-gray-100 border-gray-300 text-gray-900';
      case 'contradiction': return 'bg-red-100 border-red-300 text-red-900';
      case 'treatment': return 'bg-purple-100 border-purple-300 text-purple-900';
      case 'outcome': return 'bg-green-100 border-green-300 text-green-900';
      case 'breakthrough': return 'bg-yellow-100 border-yellow-300 text-yellow-900';
      default: return 'bg-gray-100 border-gray-300 text-gray-900';
    }
  };

  return (
    <div
      className={cn(
        "px-3 py-2 rounded-lg border-2 shadow-sm transition-all",
        "min-w-[120px] max-w-[200px]",
        getNodeColor(),
        isHighlighted && "ring-2 ring-blue-500 ring-offset-2",
        isSelected && "shadow-lg scale-105"
      )}
    >
      <div className="flex items-center gap-2">
        {getNodeIcon()}
        <div className="flex-1">
          <p className="text-xs font-medium truncate">{node.label}</p>
          {node.importance && (
            <div className="flex items-center gap-1 mt-1">
              <div className="h-1 bg-gray-200 rounded-full flex-1">
                <div
                  className="h-1 bg-current rounded-full"
                  style={{ width: `${node.importance * 10}%` }}
                />
              </div>
              <span className="text-[10px] opacity-70">{node.importance}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  custom: CustomNode
};

function KnowledgeGraphContent({
  findings,
  digest,
  timeline = [],
  onNodeClick,
  onNodeDoubleClick,
  className
}: KnowledgeGraphVisualizationProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [showNodeDetails, setShowNodeDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<GraphFilter>({
    minImportance: 0,
    minEdgeStrength: 0.3,
    showOnlyConnected: false
  });

  const { fitView, zoomIn, zoomOut, getZoom } = useReactFlow();

  // Build graph when data changes
  useEffect(() => {
    const graph = knowledgeGraphService.buildGraph(findings, digest, timeline);
    const flowElements = knowledgeGraphService.toReactFlowElements(
      graph.nodes,
      graph.edges,
      filter
    );

    setNodes(flowElements.nodes.map(node => ({
      ...node,
      type: 'custom'
    })));
    setEdges(flowElements.edges);

    // Fit view after a short delay to ensure layout is calculated
    setTimeout(() => fitView({ padding: 0.1 }), 100);
  }, [findings, digest, timeline, filter, setNodes, setEdges, fitView]);

  // Handle node selection
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const knowledgeNode = (node.data as FlowNode['data']).node;
    setSelectedNode(knowledgeNode);
    setShowNodeDetails(true);

    // Highlight connected nodes
    const graph = knowledgeGraphService.buildGraph(findings, digest, timeline);
    const connected = knowledgeGraphService.getConnectedNodes(node.id, graph.edges);
    setHighlightedNodes(connected);

    // Update node highlighting
    setNodes(nodes => nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        isSelected: n.id === node.id,
        isHighlighted: connected.has(n.id)
      }
    })));

    if (onNodeClick) {
      onNodeClick(node.id, knowledgeNode);
    }
  }, [findings, digest, timeline, setNodes, onNodeClick]);

  // Handle node double click
  const handleNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    const knowledgeNode = (node.data as FlowNode['data']).node;
    if (onNodeDoubleClick) {
      onNodeDoubleClick(node.id, knowledgeNode);
    }
  }, [onNodeDoubleClick]);

  // Search functionality
  const handleSearch = useCallback(() => {
    setFilter(prev => ({ ...prev, searchQuery }));
  }, [searchQuery]);

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setFilter(prev => ({ ...prev, searchQuery: undefined }));
  }, []);

  // Calculate graph metrics
  const metrics = useMemo(() => {
    const graph = knowledgeGraphService.buildGraph(findings, digest, timeline);
    return knowledgeGraphService.getGraphMetrics(graph.nodes, graph.edges);
  }, [findings, digest, timeline]);

  // Export graph as image
  const handleExportImage = useCallback(() => {
    // This would require additional implementation with html2canvas or similar
    console.log('Export graph as image - to be implemented');
  }, []);

  return (
    <div className={cn("relative w-full h-[600px]", className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="top-right"
      >
        <Background variant={BackgroundVariant.Dots} />
        <Controls
          showZoom={true}
          showFitView={true}
          showInteractive={true}
          position="bottom-right"
        />
        <MiniMap
          nodeColor={(node) => {
            const knowledgeNode = (node.data as FlowNode['data']).node;
            switch (knowledgeNode.type) {
              case 'theme': return '#3b82f6';
              case 'finding': return '#6b7280';
              case 'contradiction': return '#ef4444';
              case 'treatment': return '#8b5cf6';
              case 'outcome': return '#10b981';
              case 'breakthrough': return '#f59e0b';
              default: return '#6b7280';
            }
          }}
          position="bottom-left"
          pannable
          zoomable
        />

        {/* Top Panel - Search and Metrics */}
        <Panel position="top-left" className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-3">
          <div className="space-y-3">
            {/* Search Bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search nodes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-8 pr-8 h-9"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSearch}
                    className="absolute right-1 top-1 h-7 w-7 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <Button size="sm" onClick={handleSearch}>
                Search
              </Button>
            </div>

            {/* Graph Metrics */}
            <div className="flex gap-3 text-xs">
              <Badge variant="secondary">
                {metrics.nodeCount} nodes
              </Badge>
              <Badge variant="secondary">
                {metrics.edgeCount} edges
              </Badge>
              <Badge variant="secondary">
                {metrics.clusters} clusters
              </Badge>
            </div>
          </div>
        </Panel>

        {/* Settings Panel */}
        <Panel position="top-right" className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportImage}
          >
            <Download className="h-4 w-4" />
          </Button>
        </Panel>
      </ReactFlow>

      {/* Settings Sidebar */}
      {showSettings && (
        <div className="absolute top-12 right-3 w-64 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 z-10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Graph Settings</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          <div className="space-y-4">
            {/* Node Type Filter */}
            <div>
              <Label className="text-xs">Node Types</Label>
              <Select
                value={filter.nodeTypes?.[0] || 'all'}
                onValueChange={(value) => {
                  setFilter(prev => ({
                    ...prev,
                    nodeTypes: value === 'all' ? undefined : [value]
                  }));
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="finding">Findings</SelectItem>
                  <SelectItem value="theme">Themes</SelectItem>
                  <SelectItem value="contradiction">Contradictions</SelectItem>
                  <SelectItem value="treatment">Treatments</SelectItem>
                  <SelectItem value="outcome">Outcomes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Importance Filter */}
            <div>
              <Label className="text-xs">
                Min Importance: {filter.minImportance || 0}
              </Label>
              <Slider
                value={[filter.minImportance || 0]}
                onValueChange={([value]) => {
                  setFilter(prev => ({ ...prev, minImportance: value }));
                }}
                min={0}
                max={10}
                step={1}
                className="mt-1"
              />
            </div>

            {/* Edge Strength Filter */}
            <div>
              <Label className="text-xs">
                Min Edge Strength: {(filter.minEdgeStrength || 0).toFixed(1)}
              </Label>
              <Slider
                value={[(filter.minEdgeStrength || 0) * 10]}
                onValueChange={([value]) => {
                  setFilter(prev => ({ ...prev, minEdgeStrength: value / 10 }));
                }}
                min={0}
                max={10}
                step={1}
                className="mt-1"
              />
            </div>

            {/* Connected Only Toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="connected-only"
                checked={filter.showOnlyConnected}
                onChange={(e) => {
                  setFilter(prev => ({ ...prev, showOnlyConnected: e.target.checked }));
                }}
                className="h-4 w-4"
              />
              <Label htmlFor="connected-only" className="text-xs cursor-pointer">
                Show only connected nodes
              </Label>
            </div>
          </div>
        </div>
      )}

      {/* Node Details Sheet */}
      <Sheet open={showNodeDetails} onOpenChange={setShowNodeDetails}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedNode?.label}</SheetTitle>
            <SheetDescription>
              {selectedNode?.type && (
                <Badge variant="outline" className="mt-1">
                  {selectedNode.type}
                </Badge>
              )}
            </SheetDescription>
          </SheetHeader>

          {selectedNode && (
            <div className="mt-6 space-y-4">
              {selectedNode.description && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedNode.description}
                  </p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold mb-1">Metrics</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Importance</span>
                    <span className="font-medium">{selectedNode.importance}/10</span>
                  </div>
                  {selectedNode.confidence && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Confidence</span>
                      <span className="font-medium">
                        {Math.round(selectedNode.confidence * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Properties</h4>
                  <div className="space-y-1">
                    {Object.entries(selectedNode.properties).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{key}</span>
                        <span className="font-medium truncate max-w-[150px]">
                          {Array.isArray(value) ? value.join(', ') : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {highlightedNodes.size > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">
                    Connected Nodes ({highlightedNodes.size})
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    This node is connected to {highlightedNodes.size} other nodes in the graph
                  </p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function KnowledgeGraphVisualization(props: KnowledgeGraphVisualizationProps) {
  return (
    <ReactFlowProvider>
      <KnowledgeGraphContent {...props} />
    </ReactFlowProvider>
  );
}