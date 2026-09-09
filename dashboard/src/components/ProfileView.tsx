import React, { useEffect, useState } from 'react';
import { fetchProfile, fetchApprovedAnswers } from '../api';
import { ApprovedAnswer } from '../types';
import { User, ShieldCheck, Database, Check } from 'lucide-react';

export const ProfileView: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);
  const [answers, setAnswers] = useState<ApprovedAnswer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchProfile(), fetchApprovedAnswers()])
      .then(([prof, ans]) => {
        setProfile(prof);
        setAnswers(ans);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ color: '#94a3b8', padding: '32px' }}>Loading verified profile data...</div>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      {/* Verified Profile Column */}
      <div className="table-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <User size={20} color="#3b82f6" />
          <h3>Verified Candidate Profile</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
          <div>
            <span style={{ color: '#94a3b8' }}>Name:</span>{' '}
            <strong>{profile?.full_name}</strong> ({profile?.pronouns})
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Email:</span> {profile?.primary_email}
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Phone:</span> {profile?.phone}
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>University:</span> {profile?.school} — {profile?.degree} ({profile?.major})
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Graduation:</span> {profile?.graduation_date} | GPA: {profile?.gpa}/{profile?.gpa_scale}
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Work Auth:</span> Authorized in U.S. (No sponsorship needed)
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Relocation:</span> Willing to relocate (NYC, SF, Chicago, Boston)
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Compensation Rule:</span> Employer stated rate, or fallback ${profile?.fallback_hourly_rate}/hr
          </div>
        </div>

        <div style={{ marginTop: '24px', padding: '12px', backgroundColor: '#0f172a', borderRadius: '6px', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: 600, fontSize: '13px' }}>
            <ShieldCheck size={16} /> Hard Guardrail Active
          </div>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
            Blank or unsupported fields are never hallucinated. Questions lacking grounded evidence in this profile require human confirmation.
          </p>
        </div>
      </div>

      {/* Approved Reusable Answers Column */}
      <div className="table-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Database size={20} color="#8b5cf6" />
          <h3>Approved Reusable Knowledge Base</h3>
        </div>

        {answers.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '13px' }}>
            No approved answers saved yet. When you answer missing questions during an application workflow and check "Save as reusable", they will appear here.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {answers.map((ans) => (
              <div
                key={ans.id}
                style={{
                  backgroundColor: '#0f172a',
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid #334155',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#cbd5e1' }}>
                  {ans.question_pattern}
                </div>
                <div style={{ color: '#34d399', fontSize: '13px', marginTop: '4px' }}>
                  <Check size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  {ans.answer}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
