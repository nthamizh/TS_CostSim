/**
 * Standalone dev mode — mirrors ConfigIQ's main.tsx pattern exactly.
 * In production this entry point never runs; Platform loads bootstrap.tsx
 * via Module Federation.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import CostSimApp from "./bootstrap";
import "@nthamizh/ui/styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route
          path="/costsim/*"
          element={
            <CostSimApp
              apiBaseUrl="http://localhost:4000"
              basePath="/costsim"
              isPlatformAdmin={true}
              getAccessToken={() => null}
            />
          }
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
