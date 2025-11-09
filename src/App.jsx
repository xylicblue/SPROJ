// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./login";
import SignupPage from "./signup";
import DashboardPage from "./fdashboard"; // Import Dashboard
import ProtectedRoute from "./protected"; // Import ProtectedRoute
import CreateFarmPage from "./createfarm";
import UploadKmlPage from "./kmlpage";
import FarmDetailsPage from "./farmdetails";
import FarmsPage from "./farms";
import Dashboard from "./dashboard";
import { Toaster } from "react-hot-toast";
import AdminDashboardPage from "./admindash";
function App() {
  return (
    <>
      <Toaster
        position="top-right" // Position it on the top-right of the screen
        toastOptions={{
          // Define default options
          duration: 5000, // Stay on screen for 5 seconds
          style: {
            background: "#334155", // A nice dark color
            color: "#fff",
            borderRadius: "10px",
          },
          // Define styles for success and error toasts
          success: {
            style: {
              background: "#4ade80", // Green for success
              color: "#1e293b",
            },
            iconTheme: {
              primary: "#1e293b",
              secondary: "#4ade80",
            },
          },
          error: {
            style: {
              background: "#f87171", // Red for error
            },
          },
        }}
      />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Protected Dashboard Route */}
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/farmer-dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-farm"
            element={
              <ProtectedRoute>
                <CreateFarmPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upload-kml"
            element={
              <ProtectedRoute>
                <UploadKmlPage />
              </ProtectedRoute>
            }
          />

          {/* Redirect base route to dashboard or login */}
          <Route path="/" element={<LoginPage />} />
          <Route
            path="/farm/:farmId"
            element={
              <ProtectedRoute>
                <FarmDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/farms"
            element={
              <ProtectedRoute>
                <FarmsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
