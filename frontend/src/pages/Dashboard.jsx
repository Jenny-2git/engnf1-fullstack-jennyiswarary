import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

function Dashboard() {
    const navigate = useNavigate();

    const [stats, setStats] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    const user = JSON.parse(localStorage.getItem("user") || "null");

    useEffect(() => {
        async function loadDashboard() {
            try {
                const [statsResponse, ticketsResponse] = await Promise.all([
                    api.get("/stats"),
                    api.get("/tickets?page=1&limit=5")
                ]);

                setStats(statsResponse.data);
                setTickets(ticketsResponse.data.tickets || []);
            } catch (err) {
                if (err.response?.status === 401) {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");
                    navigate("/login");
                    return;
                }

                setError("Unable to load dashboard information.");
            } finally {
                setLoading(false);
            }
        }

        loadDashboard();
    }, [navigate]);

    function handleLogout() {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    }

    if (loading) return <p>Loading dashboard...</p>;

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <h1>TriageSync</h1>

                <div>
                    <span>Welcome, {user?.name || "User"}</span>
                    <button onClick={handleLogout}>Logout</button>
                </div>
            </header>

            <main className="dashboard-content">
                <h2>Dashboard Overview</h2>
                <p>Monitor your support tickets and activity.</p>

                {error && <p className="error-message">{error}</p>}

                {stats && (
                    <div className="stats-grid">
                        <div className="stat-card">
                            <h3>Total Tickets</h3>
                            <p>{stats.totalTickets ?? 0}</p>
                        </div>

                        <div className="stat-card">
                            <h3>Reviewed Tickets</h3>
                            <p>{stats.reviewedCount ?? 0}</p>
                        </div>

                        <div className="stat-card">
                            <h3>Model Agreement</h3>
                            <p>{stats.modelAgreementRate ?? 0}%</p>
                        </div>
                    </div>
                )}

                <h2>Recent Tickets</h2>

                {tickets.length === 0 ? (
                    <p>No tickets found.</p>
                ) : (
                    <div className="ticket-list">
                        {tickets.map((ticket) => (
                            <div className="ticket-card" key={ticket.id}>
                                <h3>{ticket.subject}</h3>
                                <p>Category: {ticket.category}</p>
                                <p>Priority: {ticket.priority}</p>
                                <p>Status: {ticket.status}</p>
                            </div>
                        ))}
                    </div>
                )}

                {user?.role === "ADMIN" && (
                    <button onClick={() => navigate("/admin/bookings")}>
                        Manage Bookings
                    </button>
                )}
            </main>
        </div>
    );
}

export default Dashboard;