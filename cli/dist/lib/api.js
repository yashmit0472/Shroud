const API_URL = process.env.SHROUD_API_URL ?? "http://localhost:3000";
export class ShroudApiError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}
async function request(path, token, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
            ...options.headers,
        },
    });
    const data = await response.json();
    if (!response.ok) {
        throw new ShroudApiError(data.error ?? "Shroud API request failed", response.status);
    }
    return data;
}
export async function getProjects(token) {
    const data = await request("/api/v1/projects", token);
    return data.projects;
}
export async function getEnvironments(token, projectId) {
    const data = await request(`/api/v1/projects/${projectId}/environments`, token);
    return data.environments;
}
export async function getSecrets(token, projectId, environmentId) {
    const data = await request(`/api/v1/projects/${projectId}/environments/${environmentId}/secrets`, token);
    return data.secrets;
}
export async function getSecretValue(token, projectId, environmentId, secretId) {
    return request(`/api/v1/projects/${projectId}/environments/${environmentId}/secrets/${secretId}/value`, token);
}
export async function createSecret(token, projectId, environmentId, secret) {
    return request(`/api/v1/projects/${projectId}/environments/${environmentId}/secrets`, token, {
        method: "POST",
        body: JSON.stringify(secret),
    });
}
