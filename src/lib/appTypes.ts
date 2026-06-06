import type { ClubRole } from "@/lib/clubRole";

export type ClubSummary = {
  id_club: number;
  nombre: string | null;
  nif: string | null;
  email: string | null;
};

export type ClubMembershipWithClub = {
  club_id: number;
  rol: ClubRole;
  clubes: ClubSummary | ClubSummary[] | null;
};

export type ClubMemberWithProfile = {
  user_id: string;
  rol: ClubRole;
  perfiles: { email: string | null } | { email: string | null }[] | null;
};
