
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

function Dashboard() {
    const navigate = useNavigate();

    const [stats, setStats] = useState(null);
    const [tickets, setTickets] = useState([]);
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

                console.error("Unable to load dashboard:", err);
            } finally {
                setLoading(false);
            }
        }

        loadDashboard();
    }, [navigate]);

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="loading-spinner"></div>
                <p>Preparing your dashboard...</p>
            </div>
        );
    }

const statCards = [
    {
        title: "Total Tickets",
        value: stats?.totalTickets ?? 0,
        color: "blue"
    },
    {
        title: "Reviewed Tickets",
        value: stats?.reviewedCount ?? 0,
        color: "green"
    },
    {
        title: "Model Agreement",
        value: `${stats?.modelAgreementRate ?? 0}%`,
        color: "purple"
    }
];

    return (
        <div className="dashboard-page">
            {/* Statistics */}
            <section className="dashboard-section">
                <div className="section-heading">
                    <div>
                        <h2>Performance Overview</h2>
                       
                    </div>
                    <span className="live-indicator">
                        <span></span>
                    </span>
                </div>

                <div className="stats-grid">
                    {statCards.map((card) => (
                        <div className="stat-card" key={card.title}>
                            

                            <div className="stat-information">
                                <p>{card.title}</p>
                                <h3>{card.value}</h3>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Quick actions */}
            <section className="dashboard-section">
                <div className="section-heading">
                    <div>
                        <h2>Quick Actions</h2>
                        
                    </div>
                </div>

                <div className="quick-actions-grid">
                    <button
                        className="quick-action-card"
                        onClick={() => navigate("/tickets")}
                    >
                        
                        <span>
                            <strong>View Tickets</strong>
                            
                        </span>
                        
                    </button>

                    <button
                        className="quick-action-card"
                        onClick={() => navigate("/resources")}
                    >
                        <span>
                            <strong>Browse Resources</strong>
                        </span>
                    </button>

                    <button
                        className="quick-action-card"
                        onClick={() => navigate("/my-bookings")}
                    >
                        <span>
                            <strong>My Bookings</strong>
                        </span>
                    </button>

                    {user?.role === "ADMIN" && (
                        <button
                            className="quick-action-card"
                            onClick={() => navigate("/admin/bookings")}
                        >
                            <span>
                                <strong>Admin Panel</strong>
                            </span>
                        </button>
                    )}
                </div>
            </section>

            {/* Recent tickets */}
            <section className="dashboard-section recent-section">
                <div className="section-heading">
                    <div>
                        <h2>Recent Tickets</h2>
                  
                    </div>

                    <button
                        className="text-button"
                        onClick={() => navigate("/tickets")}
                    >
                        View all tickets 
                    </button>
                </div>

                {tickets.length === 0 ? (
                    <div className="empty-state">
                        <h3>No tickets found</h3>
                        
                    </div>
                ) : (
                    <div className="recent-tickets-list">
                        {tickets.map((ticket) => (
                            <div
                                className="recent-ticket-card"
                                key={ticket.id}
                                onClick={() => navigate(`/tickets/${ticket.id}`)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        navigate(`/tickets/${ticket.id}`);
                                    }
                                }}
                            >
                                <div className="ticket-main-info">
                                    <div className="ticket-avatar">
                                        T
                                    </div>

                                    <div>
                                        <h3>{ticket.subject || "Untitled ticket"}</h3>
                                        <p>
                                            {ticket.category || "Uncategorized"}
                                            {" · "}
                                            Ticket #{ticket.id}
                                        </p>
                                    </div>
                                </div>

                                <div className="ticket-meta">
                                    <span className={`priority-badge ${(ticket.priority || "normal").toLowerCase()}`}>
                                        {ticket.priority || "Normal"}
                                    </span>

                                    <span className={`status-badge ${(ticket.status || "unknown").toLowerCase().replace(/\s+/g, "-")}`}>
                                        {ticket.status || "Unknown"}
                                    </span>

                                    <span className="ticket-arrow">→</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            
        </div>
    );
}

export default Dashboard;
