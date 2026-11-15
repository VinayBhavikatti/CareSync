import { Navigate } from 'react-router-dom';

/** Legacy route component retained as a redirect to the current Today screen. */
export function DashboardPage() {
  return <Navigate to="/today" replace />;
}
