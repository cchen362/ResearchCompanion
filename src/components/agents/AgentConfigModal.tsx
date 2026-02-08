import { useState } from 'react';
import { agentsService } from '@/services/agents.service';
import { logger } from '@/utils/logger';
import type { Agent } from '@/types';

interface AgentConfigModalProps {
  agent: Agent;
  onClose: () => void;
  onUpdate: () => void;
}

export default function AgentConfigModal({ agent, onClose, onUpdate }: AgentConfigModalProps) {
  const [updateFrequency, setUpdateFrequency] = useState(agent.config.updateFrequency);
  const [priority, setPriority] = useState(agent.config.priority);
  const [searchDepth, setSearchDepth] = useState(agent.config.searchDepth);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await agentsService.updateAgentConfig(agent.id, {
        updateFrequency,
        priority,
        searchDepth
      });
      onUpdate();
      onClose();
    } catch (error) {
      logger.error('Error updating agent config:', error);
      alert('Failed to update agent configuration');
    } finally {
      setSaving(false);
    }
  };

  // Format agent type for display
  const formatAgentType = (type: string) => {
    return type.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--color-surface)] rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
          Configure {formatAgentType(agent.type)}
        </h3>

        <div className="space-y-4">
          <div>
            <label htmlFor="frequency" className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Update Frequency
            </label>
            <select
              id="frequency"
              value={updateFrequency}
              onChange={(e) => setUpdateFrequency(e.target.value as any)}
              className="mt-1 block w-full border-[var(--color-border)] rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm px-3 py-2 border bg-[var(--color-surface)]"
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="adaptive">Adaptive (AI decides)</option>
            </select>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              How often this agent searches for new information
            </p>
          </div>

          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Priority
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="mt-1 block w-full border-[var(--color-border)] rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm px-3 py-2 border bg-[var(--color-surface)]"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Higher priority agents run first when resources are limited
            </p>
          </div>

          <div>
            <label htmlFor="depth" className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Search Depth
            </label>
            <select
              id="depth"
              value={searchDepth}
              onChange={(e) => setSearchDepth(e.target.value as any)}
              className="mt-1 block w-full border-[var(--color-border)] rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm px-3 py-2 border bg-[var(--color-surface)]"
            >
              <option value="shallow">Shallow (Quick scan)</option>
              <option value="standard">Standard (Balanced)</option>
              <option value="deep">Deep (Comprehensive)</option>
            </select>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Deeper searches find more results but cost more
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[var(--color-border)] rounded-md shadow-sm text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-sunken)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}