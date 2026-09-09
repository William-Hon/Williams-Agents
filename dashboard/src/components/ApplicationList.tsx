import React from 'react';
import { Application } from '../types';
import { Play, HelpCircle, Eye, ExternalLink, CheckCircle } from 'lucide-react';

interface ApplicationListProps {
  applications: Application[];
  onRun: (id: number) => void;
  onOpenQuestions: (app: Application) => void;
  onOpenReview: (app: Application) => void;
}

export const ApplicationList: React.FC<ApplicationListProps> = ({
  applications,
  onRun,
  onOpenQuestions,
  onOpenReview,
}) => {
  if (applications.length === 0) {
    return (
      <div className="table-card" style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
        <h3>No applications in this view.</h3>
        <p style={{ marginTop: '8px' }}>Add a new application link above or run Job Discovery.</p>
      </div>
    );
  }

  return (
    <div className="table-card">
      <table className="table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Role</th>
            <th>Location</th>
            <th>Compensation</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((app) => (
            <tr key={app.id}>
              <td>
                <strong>{app.company}</strong>
              </td>
              <td>{app.role}</td>
              <td style={{ color: '#94a3b8' }}>{app.location || '—'}</td>
              <td style={{ color: '#94a3b8' }}>{app.compensation || '—'}</td>
              <td>
                <span className={`badge badge-${app.status}`}>
                  {app.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td style={{ textAlign: 'right' }}>
                <div style={{ display: 'inline-flex', gap: '8px' }}>
                  {app.status === 'QUEUED' && (
                    <button
                      className="btn-primary"
                      style={{ padding: '4px 10px', fontSize: '13px' }}
                      onClick={() => onRun(app.id)}
                    >
                      <Play size={13} /> Run
                    </button>
                  )}

                  {app.status === 'NEEDS_INPUT' && (
                    <button
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '13px', borderColor: '#f87171', color: '#f87171' }}
                      onClick={() => onOpenQuestions(app)}
                    >
                      <HelpCircle size={13} /> Answer
                    </button>
                  )}

                  {app.status === 'READY_FOR_REVIEW' && (
                    <button
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '13px', borderColor: '#34d399', color: '#34d399' }}
                      onClick={() => onOpenReview(app)}
                    >
                      <Eye size={13} /> Review & Submit
                    </button>
                  )}

                  {app.status === 'SUBMITTED' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4ade80', fontSize: '13px' }}>
                      <CheckCircle size={14} /> Submitted
                    </span>
                  )}

                  <a
                    href={app.application_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 8px',
                      color: '#94a3b8',
                      textDecoration: 'none',
                    }}
                    title="Open application URL"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
