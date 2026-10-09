const API_BASE = "http://localhost:8000/api/v1";

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
