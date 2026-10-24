// Presentation checks only. API handlers and database policies enforce access.
export function canWrite(role: string | null) {
  return role === "owner" || role === "admin" || role === "developer";
}
export function canManage(role: string | null) {
  return role === "owner" || role === "admin";
}
