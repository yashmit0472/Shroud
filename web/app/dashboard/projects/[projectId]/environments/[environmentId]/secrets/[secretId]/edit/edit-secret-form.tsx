"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  projectId: string;
  environmentId: string;
  secretId: string;
  initialKey: string;
  initialDescription: string;
  initialRequired: boolean;
};

export function EditSecretForm({
  projectId,
  environmentId,
  secretId,
  initialKey,
  initialDescription,
  initialRequired,
}: Props) {
  const router = useRouter();

  const [key, setKey] = useState(initialKey);
  const [value, setValue] = useState("");
  const [description, setDescription] = useState(initialDescription);
  const [required, setRequired] = useState(initialRequired);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");

    if (!key.trim()) {
      setError("Variable name is required.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/v1/projects/${projectId}/environments/${environmentId}/secrets/${secretId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            key: key.trim(),
            value,
            description: description.trim(),
            is_required: required,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update environment variable.");
      }

      router.push(
        `/dashboard/projects/${projectId}/environments/${environmentId}`,
      );

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update environment variable.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="key">Variable name</Label>

        <Input
          id="key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="DATABASE_URL"
          disabled={loading}
          className="font-mono"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="value">New value</Label>

        <Input
          id="value"
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter a new value"
          disabled={loading}
          autoComplete="new-password"
          className="font-mono"
        />

        <p className="text-xs text-muted-foreground">
          Leave this blank if you only want to update the metadata.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>

        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Production database connection"
          disabled={loading}
        />
      </div>

      <label className="flex items-center gap-3">
        <Checkbox
          checked={required}
          onCheckedChange={(checked) => setRequired(checked === true)}
          disabled={loading}
        />

        <span className="text-sm">
          Required environment variable
        </span>
      </label>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() =>
            router.push(
              `/dashboard/projects/${projectId}/environments/${environmentId}`,
            )
          }
        >
          Cancel
        </Button>

        <Button type="submit" disabled={loading}>
          {loading ? "Updating..." : "Update variable"}
        </Button>
      </div>
    </form>
  );
}
