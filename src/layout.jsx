// src/components/MainLayout.jsx
import React from "react";
import Sidebar from "./sidebar";
import Header from "./head";

const MainLayout = ({ children }) => {
  return (
    <div style={{ display: "flex" }}>
      <Sidebar />
      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
        <Header />
        <main
          style={{ padding: "2.5rem 3rem", background: "#f8fafc", flexGrow: 1 }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
