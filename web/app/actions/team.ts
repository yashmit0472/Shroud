"use server";

import { createClient } from "@/lib/supabase/server";

export type CreateTeamResult =
    | {
          success: true;
          teamId: string;
          projectId: string;
      }
    | {
          success: false;
          error: string;
      };

export async function createTeam(
    teamName: string,
): Promise<CreateTeamResult> {
    const name = teamName.trim();

    if (!name) {
        return {
            success: false,
            error: "Team name is required.",
        };
    }

    if (name.length > 100) {
        return {
            success: false,
            error: "Team name must be 100 characters or fewer.",
        };
    }

    const supabase = await createClient();

    const {
        data: claimsData,
        error: claimsError,
    } = await supabase.auth.getClaims();

    if (claimsError || !claimsData?.claims?.sub) {
        return {
            success: false,
            error: "You must be signed in to create a team.",
        };
    }

    const { data, error } = await supabase.rpc("create_team", {
        team_name: name,
    });

    if (error) {
        console.error("Create team error:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
        });

        return {
            success: false,
            error: "We couldn't create your team. Please try again.",
        };
    }

    return {
        success: true,
        teamId: data.team_id,
        projectId: data.project_id,
    };
}
