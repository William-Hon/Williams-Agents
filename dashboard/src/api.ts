import { Application, ApplicationQuestion, ApprovedAnswer, WorkflowStats } from './types';

const API_BASE = '/api';

export async function fetchApplications(status?: string): Promise<Application[]> {
  const url = status ? `${API_BASE}/applications?status=${encodeURIComponent(status)}` : `${API_BASE}/applications`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch applications');
  return res.json();
}

export async function createApplication(data: Partial<Application>): Promise<Application> {
  const res = await fetch(`${API_BASE}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create application');
  return res.json();
}

export async function runApplicationWorkflow(id: number): Promise<any> {
  const res = await fetch(`${API_BASE}/applications/${id}/run`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to run application workflow');
  return res.json();
}

export async function fetchApplicationQuestions(id: number): Promise<ApplicationQuestion[]> {
  const res = await fetch(`${API_BASE}/applications/${id}/questions`);
  if (!res.ok) throw new Error('Failed to fetch questions');
  return res.json();
}

export async function answerApplicationQuestion(
  appId: number,
  questionId: number,
  answer: string,
  saveAsReusable: boolean = false
): Promise<any> {
  const res = await fetch(`${API_BASE}/applications/${appId}/questions/${questionId}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer, save_as_reusable: saveAsReusable }),
  });
  if (!res.ok) throw new Error('Failed to answer question');
  return res.json();
}

export async function markSubmitted(id: number): Promise<any> {
  const res = await fetch(`${API_BASE}/applications/${id}/submitted`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to mark submitted');
  return res.json();
}

export async function markNotSubmitted(id: number, reason: string): Promise<any> {
  const res = await fetch(`${API_BASE}/applications/${id}/not-submitted`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error('Failed to mark not submitted');
  return res.json();
}

export async function fetchWorkflowStats(): Promise<WorkflowStats> {
  const res = await fetch(`${API_BASE}/workflows/stats`);
  if (!res.ok) throw new Error('Failed to fetch workflow stats');
  return res.json();
}

export async function triggerQueueRun(): Promise<any> {
  const res = await fetch(`${API_BASE}/workflows/queue/run`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to trigger queue run');
  return res.json();
}

export async function triggerDiscovery(): Promise<any> {
  const res = await fetch(`${API_BASE}/workflows/discovery/run`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to trigger discovery');
  return res.json();
}

export async function triggerEmailCheck(): Promise<any> {
  const res = await fetch(`${API_BASE}/workflows/email/run`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to trigger email check');
  return res.json();
}

export async function fetchProfile(): Promise<any> {
  const res = await fetch(`${API_BASE}/profile`);
  if (!res.ok) throw new Error('Failed to fetch profile');
  return res.json();
}

export async function fetchApprovedAnswers(): Promise<ApprovedAnswer[]> {
  const res = await fetch(`${API_BASE}/profile/answers`);
  if (!res.ok) throw new Error('Failed to fetch approved answers');
  return res.json();
}
