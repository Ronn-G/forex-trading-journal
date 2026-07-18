import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "../shell/AppShell";
import { HealthScreen } from "../../features/status/HealthScreen";
import { AccountsScreen } from "../../features/accounts/AccountsScreen";
import { ImportScreen } from "../../features/import/ImportScreen";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        path: "/",
        element: <Navigate to="/health" replace />,
      },
      {
        path: "/health",
        element: <HealthScreen />,
      },
      {
        path: "/accounts",
        element: <AccountsScreen />,
      },
      {
        path: "/import",
        element: <ImportScreen />,
      },
    ],
  },
]);
