import { createFileRoute, Outlet } from "@tanstack/react-router";

// Seams is open to anyone with the link: no sign-in gate. Loading or replacing the findings is
// still admin-only through the data rules; viewing, approving and dismissing work for everyone.
export const Route = createFileRoute("/_authed")({
  component: () => <Outlet />,
});
