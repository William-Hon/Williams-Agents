import React, { useState, useEffect } from 'react';
import { X, HelpCircle } from 'lucide-react';
import { Application, ApplicationQuestion } from '../types';
import { fetchApplicationQuestions, answerApplicationQuestion } from '../api';

interface QuestionModalProps {
  application: Application | null;
  onClose: () => void;
  onAnswerSubmitted: () => void;
}

export const QuestionModal: React.FC<QuestionModalProps> = ({
  application,
  onClose,
  onAnswerSubmitted,
}) => {
  const [questions, setQuestions] = useState<ApplicationQuestion[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<ApplicationQuestion | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [saveAsReusable, setSaveAsReusable] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (application) {
      fetchApplicationQuestions(application.id).then((qs) => {
        setQuestions(qs);
        const pending = qs.find((q) => q.needs_human && !q.answer);
        setActiveQuestion(pending || null);
        setAnswerText(pending?.answer || '');
      });
    }
  }, [application]);

  if (!application || !activeQuestion) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerText.trim()) return;
    setSubmitting(true);
    try {
      await answerApplicationQuestion(
        application.id,
        activeQuestion.id,
        answerText.trim(),
        saveAsReusable
      );
      onAnswerSubmitted();
      onClose();
    } catch (err) {
      alert('Failed to save answer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HelpCircle size={20} color="#f87171" />
            <h3>Missing Information - {application.company}</h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', color: '#94a3b8' }}>
            <X size={20} />
          </button>
        </div>

        <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px' }}>
          The workflow paused because an unanswered or sensitive field was detected that could not be verified from your profile.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label style={{ color: '#f8fafc', fontSize: '14px', fontWeight: 600 }}>Question:</label>
            <div
              style={{
                backgroundColor: '#0f172a',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #334155',
                fontSize: '14px',
              }}
            >
              {activeQuestion.question_text}
            </div>
          </div>

          <div className="form-group">
            <label>Your Answer *</label>
            <textarea
              rows={4}
              placeholder="Enter your verified answer here..."
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              required
            />
          </div>

          <div style={{ margin: '16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="reusable"
              checked={saveAsReusable}
              onChange={(e) => setSaveAsReusable(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            <label htmlFor="reusable" style={{ fontSize: '13px', cursor: 'pointer' }}>
              Save as reusable answer for future applications
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save & Resume Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
