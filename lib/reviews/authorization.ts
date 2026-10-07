const REVIEW_MODERATOR_ROLES = ["super_admin"] as const;

export function canModerateReviews(roles: readonly string[]): boolean {
  return roles.some((role) => REVIEW_MODERATOR_ROLES.includes(role as (typeof REVIEW_MODERATOR_ROLES)[number]));
}
