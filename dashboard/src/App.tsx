import React, { useState, useEffect } from 'react';
import { Application, WorkflowStats } from './types';
import {
  fetchApplications,
  fetchWorkflowStats,
  runApplicationWorkflow,
  triggerQueueRun,
  triggerDiscovery,
  triggerEmailCheck,
} from './api';
import { StatsCards } from './components/StatsCards';
import { ApplicationList } from './components/ApplicationList';
import { AddApplicationModal } from './components/AddApplicationModal';
import { QuestionModal } from './components/QuestionModal';
import { ReviewModal } from './components/ReviewModal';
import { ProfileView } from './components/ProfileView';
import { Plus, Play, Compass, Mail, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'needs_input' | 'ready' | 'submitted' | 'profile'>('all');
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [loading, setLoading] = useState(false);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [questionApp, setQuestionApp] = useState<Application | null>(null);
  const [reviewApp, setReviewApp] = useState<Application | null>(null);

  const loadData = async () => {
    try {
      const [apps, st] = await Promise.all([fetchApplications(), fetchWorkflowStats()]);
      setApplications(apps);
      setStats(st);
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleRun = async (id: number) => {
    try {
      await runApplicationWorkflow(id);
      loadData();
    } catch (e) {
      alert('Failed to start application workflow');
    }
  };

  const handleRunQueue = async () => {
    try {
      await triggerQueueRun();
      loadData();
    } catch (e) {
      alert('Failed to run queued applications');
    }
  };

  const handleDiscovery = async () => {
    try {
      await triggerDiscovery();
      loadData();
    } catch (e) {
      alert('Failed to trigger job discovery');
    }
  };

  const handleEmailCheck = async () => {
    try {
      await triggerEmailCheck();
      loadData();
    } catch (e) {
      alert('Failed to trigger email check');
    }
  };

  const filteredApps = applications.filter((app) => {
    if (activeTab === 'needs_input') return app.status === 'NEEDS_INPUT';
    if (activeTab === 'ready') return app.status === 'READY_FOR_REVIEW';
    if (activeTab === 'submitted') return app.status === 'SUBMITTED';
    return true;
  });

  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <div className="logo-group">
          <div className="logo-badge">⚡</div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Agentic Application Workflow</h2>
            <p style={{ fontSize: '12px', color: '#94a3b8' }}>Human-in-the-Loop Job Application Automation</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="nav-tabs">
          <button
            className={`nav-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            Dashboard
          </button>
          <button
            className={`nav-btn ${activeTab === 'needs_input' ? 'active' : ''}`}
            onClick={() => setActiveTab('needs_input')}
          >
            Needs Input {stats?.needs_input ? `(${stats.needs_input})` : ''}
          </button>
          <button
            className={`nav-btn ${activeTab === 'ready' ? 'active' : ''}`}
            onClick={() => setActiveTab('ready')}
          >
            Ready for Review {stats?.ready_for_review ? `(${stats.ready_for_review})` : ''}
          </button>
          <button
            className={`nav-btn ${activeTab === 'submitted' ? 'active' : ''}`}
            onClick={() => setActiveTab('submitted')}
          >
            Submitted
          </button>
          <button
            className={`nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Profile & Rules
          </button>
        </div>
      </header>

      {/* Metrics Banner */}
      <StatsCards stats={stats} />

      {/* Action Controls Bar */}
      <div className="controls-bar">
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-primary" onClick={() => setIsAddOpen(true)}>
            <Plus size={16} /> Add Application URL
          </button>
          <button className="btn-secondary" onClick={handleRunQueue}>
            <Play size={15} /> Run Queued
          </button>
        </div>

        <div className="action-buttons">
          <button className="btn-secondary" onClick={handleDiscovery} title="Run Job Discovery workflow">
            <Compass size={15} /> Discover Jobs
          </button>
          <button className="btn-secondary" onClick={handleEmailCheck} title="Scan recruiting emails">
            <Mail size={15} /> Check Emails
          </button>
          <button className="btn-secondary" onClick={loadData} title="Refresh data">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Content Body */}
      {activeTab === 'profile' ? (
        <ProfileView />
      ) : (
        <ApplicationList
          applications={filteredApps}
          onRun={handleRun}
          onOpenQuestions={(app) => setQuestionApp(app)}
          onOpenReview={(app) => setReviewApp(app)}
        />
      )}

      {/* Modals */}
      <AddApplicationModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={loadData}
      />

      <QuestionModal
        application={questionApp}
        onClose={() => setQuestionApp(null)}
        onAnswerSubmitted={loadData}
      />

      <ReviewModal
        application={reviewApp}
        onClose={() => setReviewApp(null)}
        onStatusUpdated={loadData}
      />
    </div>
  );
};
export default App;
