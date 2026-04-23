import React from "react";
import ReactDOM from "react-dom/client";
import "../shared/base.css";
import "./options.css";
import { OptionsApp } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>,
);
