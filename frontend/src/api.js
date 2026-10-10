const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

export function getMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  const rootUrl = API_BASE.replace(/\/api\/v1\/?$/, '');
  return `${rootUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

export async function uploadImage(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to upload image');
  }

  return res.json();
}

export async function checkHealth() {
  try {
    const rootUrl = API_BASE.replace(/\/api\/v1\/?$/, '');
    const res = await fetch(`${rootUrl}/`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function submitComplaint(data) {
  const res = await fetch(`${API_BASE}/complaints/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function submitExternalWebhook(data) {
  const res = await fetch(`${API_BASE}/complaints/external-webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchIncidents(category = "all", status = "all") {
  const params = new URLSearchParams();
  if (category && category !== "all") params.append("category", category);
  if (status && status !== "all") params.append("status", status);
  
  const res = await fetch(`${API_BASE}/incidents?${params.toString()}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateIncidentStatus(incidentId, status, assignedDept) {
  const res = await fetch(`${API_BASE}/incidents/${incidentId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, assigned_department: assignedDept }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function seedDemoData() {
  const res = await fetch(`${API_BASE}/seed-sample-data`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
