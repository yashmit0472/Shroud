const API_URL = process.env.SHROUD_API_URL ?? "http://localhost:3000";

export class ShroudApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

async function request<T>(
    path: string,
    token: string,
    options: RequestInit = {},
): Promise<T> {
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
        throw new ShroudApiError(
            data.error ?? "Shroud API request failed",
            response.status,
        );
    }

    return data as T;
}

export type Project = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    created_at: string;
    updated_at: string;
};

export type Environment = {
    id: string;
    project_id: string;
    name: string;
    slug: string;
    type: "development" | "staging" | "production";
    created_at: string;
};

export type Secret = {
    id: string;
    key: string;
    description: string | null;
    is_required: boolean;
};

export type SecretValue = {
    id: string;
    key: string;
    value: string;
};

export async function getProjects(
    token: string,
): Promise<Project[]> {
    const data = await request<{ projects: Project[] }>(
        "/api/v1/projects",
        token,
    );

    return data.projects;
}

export async function getEnvironments(
    token: string,
    projectId: string,
): Promise<Environment[]> {
    const data = await request<{ environments: Environment[] }>(
        `/api/v1/projects/${projectId}/environments`,
        token,
    );

    return data.environments;
}

export async function getSecrets(
    token: string,
    projectId: string,
    environmentId: string,
): Promise<Secret[]> {
    const data = await request<{ secrets: Secret[] }>(
        `/api/v1/projects/${projectId}/environments/${environmentId}/secrets`,
        token,
    );

    return data.secrets;
}

export async function getSecretValue(
    token: string,
    projectId: string,
    environmentId: string,
    secretId: string,
): Promise<SecretValue> {
    return request<SecretValue>(
        `/api/v1/projects/${projectId}/environments/${environmentId}/secrets/${secretId}/value`,
        token,
    );
}

export type PushSecretInput = {
    key: string;
    value: string;
    description?: string | null;
    is_required?: boolean;
};

export async function createSecret(
    token: string,
    projectId: string,
    environmentId: string,
    secret: PushSecretInput,
) {
    return request<{
        secret: {
            id: string;
            key: string;
            description: string | null;
            is_required: boolean;
            version: number;
        } | null;
    }>(
        `/api/v1/projects/${projectId}/environments/${environmentId}/secrets`,
        token,
        {
            method: "POST",
            body: JSON.stringify(secret),
        },
    );
}

export async function getAllSecretValues(
    token: string,
    projectId: string,
    environmentId: string,
): Promise<SecretValue[]> {
    const secrets = await getSecrets(
        token,
        projectId,
        environmentId,
    );

    const values = await Promise.all(
        secrets.map((secret) =>
            getSecretValue(
                token,
                projectId,
                environmentId,
                secret.id,
            ),
        ),
    );

    return values;
}

export async function getAllSecretValuesBulk(
    token: string,
    projectId: string,
    environmentId: string,
): Promise<SecretValue[]> {
    const data = await request<{
        secrets: SecretValue[];
    }>(
        `/api/v1/projects/${projectId}/environments/${environmentId}/secrets/values`,
        token,
    );

    return data.secrets;
}

export type Team = {
    id: string;
    name: string;
    slug: string;
    owner_id: string;
    role: "owner" | "admin" | "developer" | "viewer";
    created_at: string;
    updated_at: string;
};

export async function getTeams(
    token: string,
): Promise<Team[]> {
    const data = await request<{ teams: Team[] }>(
        "/api/v1/teams",
        token,
    );

    return data.teams;
}
