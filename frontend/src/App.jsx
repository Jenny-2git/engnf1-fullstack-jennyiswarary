import "./index.css"; // <-- Add this at line 1 of App.jsx
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import TicketQueue from "./pages/TicketQueue";
import TicketDetail from "./pages/TicketDetail";
import Resources from "./pages/Resources";
import ResourceDetail from "./pages/ResourceDetail";
import MyBookings from "./pages/MyBookings";
import AdminBookings from "./pages/AdminBookings";
import AdminResources from "./pages/AdminResources";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import TicketImport from "./pages/TicketImport";
import Dashboard from "./pages/Dashboard";

function App() {
    return (
        <BrowserRouter>
            {localStorage.getItem("token") && <Navbar />}

            <main className="main-content">
                <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<Navigate to="/login" replace />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />

                    {/* Routes for logged-in users */}
                    <Route element={<ProtectedRoute allowedRoles={["USER", "ADMIN"]} />}>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/tickets" element={<TicketQueue />} />
                        <Route path="/tickets/:id" element={<TicketDetail />} />
                        <Route path="/resources" element={<Resources />} />
                        <Route path="/resources/:id" element={<ResourceDetail />} />
                        <Route path="/my-bookings" element={<MyBookings />} />
                    </Route>

                    {/* Admin-only routes */}
                    <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
                        <Route path="/admin/bookings" element={<AdminBookings />} />
                        <Route path="/admin/resources" element={<AdminResources />} />
                        <Route path="/tickets/import" element={<TicketImport />} />
                    </Route>
                </Routes>
            </main>
        </BrowserRouter>
    );
}

export default App;
