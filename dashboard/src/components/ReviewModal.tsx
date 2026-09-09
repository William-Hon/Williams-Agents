import React, { useState } from 'react';
import { X, ExternalLink, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { Application } from '../types';
import { markSubmitted, markNotSubmitted } from '../api';

interface ReviewModalProps {
  application: Application | null;
  onClose: () => void;
  onStatusUpdated: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  application,
  onClose,
  onStatusUpdated,
}) => {
  const [rejectReason, setRejectReason] = useState('Decided not to apply');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!application) return null;

  const handleSubmitted = async () => {
    setSubmitting(true);
    try {
      await markSubmitted(application.id);
      onStatusUpdated();
      onClose();
    } catch (err) {
      alert('Failed to mark submitted');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNotSubmitted = async () => {
    setSubmitting(true);
    try {
      await markNotSubmitted(application.id, rejectReason);
      onStatusUpdated();
      onClose();
    } catch (err) {
      alert('Failed to mark not submitted');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '620px' }}>
        <div className="modal-header">
          <div>
            <h3>Review & Submission Gate</h3>
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>
              {application.company} — {application.role}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', color: '#94a3b8' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #334155' }}>
          <h4 style={{ fontSize: '14px', marginBottom: '8px', color: '#34d399' }}>
            ✓ Browser Automation Reached Final Review Page
          </h4>
          <p style={{ fontSize: '13px', color: '#cbd5e1' }}>
            Playwright has automatically populated verified fields, attached your tailored resume, and left the browser session ready for your final manual review.
          </p>

          <div style={{ marginTop: '14px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a
              href={application.application_url}
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
              style={{ textDecoration: 'none', fontSize: '13px', padding: '6px 12px' }}
            >
              <ExternalLink size={14} /> Open Portal Review Page
            </a>

            {application.resume_path && (
              <a
                href={`/api/files/${application.resume_path}`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
                style={{ textDecoration: 'none', fontSize: '13px', padding: '6px 12px' }}
              >
                <FileText size={14} /> View Tailored Resume
              </a>
            )}

            {application.cover_letter_path && (
              <a
                href={`/api/files/${application.cover_letter_path}`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
                style={{ textDecoration: 'none', fontSize: '13px', padding: '6px 12px' }}
              >
                <FileText size={14} /> View Cover Letter
              </a>
            )}
          </div>
        </div>

        <div style={{ borderTop: '1px solid #334155', paddingTop: '16px' }}>
          <p style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>
            Did you inspect and submit this application?
          </p>

          {!showRejectInput ? (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn-success"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'center' }}
                onClick={handleSubmitted}
                disabled={submitting}
              >
                <CheckCircle2 size={16} /> Mark Submitted
              </button>
              <button
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'center' }}
                onClick={() => setShowRejectInput(true)}
                disabled={submitting}
              >
                <XCircle size={16} /> Mark Not Submitted
              </button>
            </div>
          ) : (
            <div>
              <div className="form-group">
                <label>Reason for not submitting:</label>
                <select
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                >
                  <option value="Decided not to apply">Decided not to apply</option>
                  <option value="Eligibility issue">Eligibility issue</option>
                  <option value="Application closed">Application closed</option>
                  <option value="Duplicate">Duplicate</option>
                  <option value="Technical issue">Technical issue</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowRejectInput(false)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={handleNotSubmitted}
                  disabled={submitting}
                >
                  Confirm Not Submitted
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
