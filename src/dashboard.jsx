// src/pages/Dashboard.jsx
import { useState, useEffect } from "react";
import { supabase } from "./createclient";
import { Navigate } from "react-router-dom";
import Spinner from "./spinner";

const Dashboard = () => {
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        setUserRole(data?.role);
      }
      setLoading(false);
    };
    fetchUserRole();
  }, []);

  if (loading) return <Spinner></Spinner>;

  if (userRole === "admin") {
    // console.log("here");
    return <Navigate to="/admin-dashboard" />;
  }
  if (userRole === "farmer") {
    // console.log("here haha");
    return <Navigate to="/farmer-dashboard" />;
  }
  return <Navigate to="/login" />; // Fallback
};

export default Dashboard;
