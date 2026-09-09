import React from 'react';
import { WorkflowStats } from '../types';

interface StatsCardsProps {
  stats: WorkflowStats | null;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <span className="stat-title">Total Applications</span>
        <span className="stat-value">{stats?.total_applications ?? 0}</span>
      </div>
      <div className="stat-card">
        <span className="stat-title">Ready for Review</span>
        <span className="stat-value" style={{ color: '#34d399' }}>
          {stats?.ready_for_review ?? 0}
        </span>
      </div>
      <div className="stat-card">
        <span className="stat-title">Needs Input</span>
        <span className="stat-value" style={{ color: '#f87171' }}>
          {stats?.needs_input ?? 0}
        </span>
      </div>
      <div className="stat-card">
        <span className="stat-title">Queued</span>
        <span className="stat-value" style={{ color: '#60a5fa' }}>
          {stats?.queued ?? 0}
        </span>
      </div>
      <div className="stat-card">
        <span className="stat-title">Submitted</span>
        <span className="stat-value" style={{ color: '#4ade80' }}>
          {stats?.submitted ?? 0}
        </span>
      </div>
      <div className="stat-card">
        <span className="stat-title">Auto-Fill Accuracy</span>
        <span className="stat-value" style={{ color: '#c084fc' }}>
          {stats?.auto_fill_rate_percent ?? 100}%
        </span>
      </div>
    </div>
  );
};
