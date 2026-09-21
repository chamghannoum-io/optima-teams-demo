import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { ApolloProvider } from "@apollo/client";
import { clientV2 } from "./apollo.js";
import TeamsPage from "./features/master-data/teams.js";
import RcmDashboardPage from "./features/rcm-dashboard/index.js";
import { AppShell } from "./vendor/app/shell.js";
import "./app.css";

/**
 * Two real pages: the Teams page and the RCM Supervisor Dashboard, the latter
 * byte-identical to features/rcm-dashboard upstream. The icon rail switches
 * between them, so the dashboard is reachable the same way it is in the app.
 */
function App() {
  const [path, setPath] = useState("/master-data/teams");
  return (
    <AppShell initialPath={path} onNavigate={setPath}>
      {path === "/dashboard" ? <RcmDashboardPage /> : <TeamsPage />}
    </AppShell>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ApolloProvider client={clientV2}>
      <App />
    </ApolloProvider>
  </React.StrictMode>
);
