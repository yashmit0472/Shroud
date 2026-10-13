"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
    Copy,
    Loader2,
    MailPlus,
    Shield,
    Trash2,
    UserRound,
} from "lucide-react";

type TeamRole = "owner" | "admin" | "developer" | "viewer";

type Member = {
    id: string;
    user_id: string;
    full_name: string | null;
    avatar_url: string | null;
    role: TeamRole;
    created_at: string;
};

type Invitation = {
    id: string;
    role: TeamRole;
    expires_at: string;
    created_at: string;
    invited_by: string;
};

type Props = {
    teamId: string;
    currentUserId: string;
    currentUserRole: TeamRole;
};

export function TeamMembers({
    teamId,
    currentUserId,
    currentUserRole,
}: Props) {
    const [members, setMembers] = useState<Member[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [error, setError] = useState("");

    const canManage =
        currentUserRole === "owner" ||
        currentUserRole === "admin";

    const loadTeam = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const [membersResponse, invitationsResponse] =
                await Promise.all([
                    fetch(`/api/v1/teams/${teamId}/members`),
                    canManage
                        ? fetch(
                              `/api/v1/teams/${teamId}/invitations`,
                          )
                        : Promise.resolve(null),
                ]);

            const membersData =
                await membersResponse.json();
            if (!membersResponse.ok) throw new Error(membersData.error ?? "Unable to load team members.");

            setMembers(membersData.members ?? []);

            if (invitationsResponse) {
                const invitationsData =
                    await invitationsResponse.json();
                if (!invitationsResponse.ok) throw new Error(invitationsData.error ?? "Unable to load invitations.");

                setInvitations(
                    invitationsData.invitations ?? [],
                );
            }
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Unable to load team.");
        } finally {
            setLoading(false);
        }
    }, [teamId, canManage]);

    useEffect(() => {
        loadTeam();
    }, [loadTeam]);

    async function removeMember(userId: string) {
        const confirmed = window.confirm(
            "Remove this member from the team?",
        );

        if (!confirmed) return;

        const response = await fetch(
            `/api/v1/teams/${teamId}/members/${userId}`,
            {
                method: "DELETE",
            },
        );

        const data = await response.json();

        if (!response.ok) {
            window.alert(
                data.error ?? "Failed to remove member.",
            );
            return;
        }

        setMembers((current) =>
            current.filter(
                (member) => member.user_id !== userId,
            ),
        );
    }

    if (loading && !inviteOpen) {
        return (
            <div className="flex min-h-[300px] items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Shield className="size-5" />
                        <h1 className="text-xl font-semibold">
                            Team members
                        </h1>
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                        Manage who has access to this team.
                    </p>
                </div>

                {canManage && (
                    <button
                        type="button"
                        onClick={() => setInviteOpen(true)}
                        className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                        <MailPlus className="size-4" />
                        Create invitation link
                    </button>
                )}
            </div>

            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            {!canManage && <p className="text-sm text-muted-foreground">Only workspace owners and admins can generate invitations.</p>}

            {/* Members */}
            <section className="rounded-xl border bg-card">
                <div className="border-b px-5 py-4">
                    <h2 className="text-sm font-medium">
                        Members
                    </h2>

                    <p className="mt-1 text-xs text-muted-foreground">
                        {members.length}{" "}
                        {members.length === 1
                            ? "member"
                            : "members"}
                    </p>
                </div>

                <div className="divide-y">
                    {members.map((member) => {
                        const isSelf =
                            member.user_id ===
                            currentUserId;

                        return (
                            <div
                                key={member.id}
                                className="flex items-center justify-between gap-4 px-5 py-4"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
                                        {member.avatar_url ? (
                                            <Image
                                                src={
                                                    member.avatar_url
                                                }
                                                alt=""
                                                width={36} height={36} unoptimized
                                                className="size-full object-cover"
                                            />
                                        ) : (
                                            <UserRound className="size-4 text-muted-foreground" />
                                        )}
                                    </div>

                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-medium">
                                            {member.full_name ||
                                                "Unnamed user"}
                                            {isSelf && (
                                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                                    You
                                                </span>
                                            )}
                                        </div>

                                        <div className="text-xs text-muted-foreground">
                                            Joined{" "}
                                            {new Date(
                                                member.created_at,
                                            ).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <RoleBadge
                                        role={member.role}
                                    />

                                    {canManage &&
                                        !isSelf &&
                                        member.role !==
                                            "owner" && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeMember(
                                                        member.user_id,
                                                    )
                                                }
                                                className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                                title="Remove member"
                                            >
                                                <Trash2 className="size-4" />
                                            </button>
                                        )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Pending invitations */}
            {canManage &&
                invitations.length > 0 && (
                    <section className="rounded-xl border bg-card">
                        <div className="border-b px-5 py-4">
                            <h2 className="text-sm font-medium">
                                Pending invitations
                            </h2>

                            <p className="mt-1 text-xs text-muted-foreground">
                                Invitations that haven&apos;t
                                been accepted yet.
                            </p>
                        </div>

                        <div className="divide-y">
                            {invitations.map(
                                (invitation) => (
                                    <div
                                        key={
                                            invitation.id
                                        }
                                        className="flex items-center justify-between gap-4 px-5 py-4"
                                    >
                                        <div>
                                            <div className="text-sm font-medium">
                                                Team invitation
                                            </div>

                                            <div className="mt-1 text-xs text-muted-foreground">
                                                Expires{" "}
                                                {new Date(
                                                    invitation.expires_at,
                                                ).toLocaleDateString()}
                                            </div>
                                        </div>

                                        <RoleBadge
                                            role={
                                                invitation.role
                                            }
                                        />
                                    </div>
                                ),
                            )}
                        </div>
                    </section>
                )}

            {inviteOpen && (
                <InviteMemberModal
                    teamId={teamId}
                    onClose={() =>
                        setInviteOpen(false)
                    }
                    onCreated={loadTeam}
                />
            )}
        </div>
    );
}

function RoleBadge({ role }: { role: TeamRole }) {
    return (
        <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize">
            {role}
        </span>
    );
}

function InviteMemberModal({
    teamId,
    onClose,
    onCreated,
}: {
    teamId: string;
    onClose: () => void;
    onCreated: () => Promise<void>;
}) {
    const [role, setRole] =
        useState<"admin" | "developer" | "viewer">(
            "developer",
        );

    const [expires, setExpires] = useState("7");

    const [loading, setLoading] = useState(false);

    const [result, setResult] = useState<{
        token: string;
        invite_code: string;
    } | null>(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    async function createInvitation() {
        setLoading(true);
        setError("");

        try {
            const response = await fetch(
                `/api/v1/teams/${teamId}/invitations`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        role,
                        expires_in_days: Number(expires),
                    }),
                },
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error ?? "Failed to create invitation.");
            }

            setResult({
                token: data.invitation.token,
                invite_code:
                    data.invitation.invite_code,
            });

            await onCreated();
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Failed to create invitation.");
        } finally {
            setLoading(false);
        }
    }

    async function copy(value: string) {
        setError("");
        setNotice("");
        try {
            await navigator.clipboard.writeText(value);
            setNotice("Copied to clipboard.");
        } catch {
            setError("Copy failed. Select and copy the value manually.");
        }
    }

    const inviteLink =
        typeof window !== "undefined" && result
            ? `${window.location.origin}/invite/${result.token}`
            : "";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" aria-labelledby="invitation-title" className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border bg-background shadow-xl">
                <div className="border-b px-5 py-4">
                    <h2 id="invitation-title" className="font-semibold">
                        Invite a team member
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                        Create a secure invitation for your
                        teammate.
                    </p>
                </div>

                {error && <p role="alert" className="px-5 pt-4 text-sm text-red-300">{error}</p>}
                {notice && <p role="status" className="px-5 pt-4 text-sm text-lime-300">{notice}</p>}

                {!result ? (
                    <>
                        <div className="space-y-5 px-5 py-5">
                            <div>
                                <label className="mb-2 block text-sm font-medium">
                                    Role
                                </label>

                                <select
                                    value={role}
                                    onChange={(event) =>
                                        setRole(
                                            event.target
                                                .value as
                                                | "admin"
                                                | "developer"
                                                | "viewer",
                                        )
                                    }
                                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                                >
                                    <option value="developer">
                                        Developer
                                    </option>
                                    <option value="admin">
                                        Admin
                                    </option>
                                    <option value="viewer">
                                        Viewer
                                    </option>
                                </select>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium">
                                    Expires in
                                </label>

                                <select
                                    value={expires}
                                    onChange={(event) =>
                                        setExpires(
                                            event.target.value,
                                        )
                                    }
                                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                                >
                                    <option value="1">
                                        1 day
                                    </option>
                                    <option value="7">
                                        7 days
                                    </option>
                                    <option value="14">
                                        14 days
                                    </option>
                                    <option value="30">
                                        30 days
                                    </option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 border-t px-5 py-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="h-9 rounded-md border px-3 text-sm"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                disabled={loading}
                                onClick={
                                    createInvitation
                                }
                                className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                            >
                                {loading && (
                                    <Loader2 className="size-4 animate-spin" />
                                )}
                                Create invitation
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="space-y-5 px-5 py-5">
                        <div className="rounded-lg border bg-muted/40 p-4">
                            <p className="text-sm font-medium">
                                Invitation created
                            </p>

                            <p className="mt-1 text-xs text-muted-foreground">
                                Copy the token now. It won&apos;t
                                be shown again.
                            </p>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-medium">
                                Invite code
                            </label>

                            <div className="flex gap-2">
                                <input
                                    readOnly
                                    value={
                                        result.invite_code
                                    }
                                    className="h-9 min-w-0 flex-1 rounded-md border bg-muted px-3 font-mono text-sm"
                                />

                                <button
                                    type="button"
                                    onClick={() =>
                                        copy(
                                            result.invite_code,
                                        )
                                    }
                                    className="rounded-md border px-3"
                                >
                                    <Copy className="size-4" />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-medium">
                                Invitation token
                            </label>

                            <div className="flex gap-2">
                                <input
                                    readOnly
                                    value={result.token}
                                    className="h-9 min-w-0 flex-1 rounded-md border bg-muted px-3 font-mono text-xs"
                                />

                                <button
                                    type="button"
                                    onClick={() =>
                                        copy(result.token)
                                    }
                                    className="rounded-md border px-3"
                                >
                                    <Copy className="size-4" />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-medium">
                                Invite link
                            </label>

                            <div className="flex gap-2">
                                <input
                                    readOnly
                                    value={inviteLink}
                                    className="h-9 min-w-0 flex-1 rounded-md border bg-muted px-3 font-mono text-xs"
                                />

                                <button
                                    type="button"
                                    onClick={() => copy(inviteLink)}
                                    className="rounded-md border px-3"
                                >
                                    <Copy className="size-4" />
                                </button>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="h-9 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground"
                        >
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
