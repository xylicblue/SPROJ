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
import AdminDashboardPage from "./admindash";
function App() {
  return (
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
  );
}

export default App;
