import React from "react";
import ReactDOM from "react-dom/client";
import { ApolloProvider } from "@apollo/client";
import { clientV2 } from "./apollo.js";
import TeamsPage from "./features/master-data/teams.js";
import { AppShell } from "./vendor/app/shell.js";
import "./app.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ApolloProvider client={clientV2}>
      <AppShell>
        <TeamsPage />
      </AppShell>
    </ApolloProvider>
  </React.StrictMode>
);
