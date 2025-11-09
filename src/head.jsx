// src/components/Header.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./createclient";
import { useAuth } from "./useauth"; // Our custom hook
import Notifications from "./notifications";
import "./head.css";

const Header = () => {
  const { user } = useAuth(); // We just need the user object here
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <header className="main-header">
      <div className="header-content">
        <div className="header-actions">
          <Notifications />
          <div className="user-menu">
            <div className="user-avatar">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-email">{user?.email}</span>
              <button onClick={handleLogout} className="logout-button">
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
