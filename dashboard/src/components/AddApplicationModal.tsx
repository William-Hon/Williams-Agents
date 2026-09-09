import React, { useState } from 'react';
import { X } from 'lucide-react';
import { createApplication } from '../api';

interface AddApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddApplicationModal: React.FC<AddApplicationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('Software Engineering Intern');
  const [url, setUrl] = useState('');
  const [location, setLocation] = useState('');
  const [compensation, setCompensation] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !url) return;
    setLoading(true);
    try {
      await createApplication({
        company,
        role,
        application_url: url,
        location: location || undefined,
        compensation: compensation || undefined,
        notes: notes || undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      alert('Error creating application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Add New Application</h3>
          <button onClick={onClose} style={{ background: 'transparent', color: '#94a3b8' }}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Application URL *</label>
            <input
              type="url"
              placeholder="https://boards.greenhouse.io/company/jobs/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Company *</label>
            <input
              type="text"
              placeholder="e.g. Scale AI"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Role</label>
            <input
              type="text"
              placeholder="Software Engineering Intern"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                placeholder="e.g. Boston, MA or Remote"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Posted Compensation</label>
              <input
                type="text"
                placeholder="e.g. $55/hr"
                value={compensation}
                onChange={(e) => setCompensation(e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Job Description Notes / Key Requirements</label>
            <textarea
              rows={3}
              placeholder="Paste responsibilities or notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
