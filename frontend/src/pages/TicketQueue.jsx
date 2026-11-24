
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

function TicketQueue() {
    const navigate = useNavigate();

    const [tickets, setTickets] = useState([]);

    const [filters, setFilters] = useState({
        status: "",
        category: "",
        priority: "",
        q: ""
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Fetch tickets whenever filters change
    useEffect(() => {
        let isActive = true;

        async function fetchTickets() {
            setLoading(true);
            setError("");

            try {
                const params = new URLSearchParams();

                Object.entries(filters).forEach(([key, value]) => {
                    if (value.trim()) {
                        params.append(key, value.trim());
                    }
                });

                const response = await api.get(
                    `/tickets?${params.toString()}`
                );

                if (isActive) {
                    setTickets(response.data.data || []);
                }

            } catch (err) {
                console.error("Ticket loading error:", err);

                if (isActive) {
                    setError(
                        err.response?.data?.error?.message ||
                        "Unable to load tickets."
                    );
                }

            } finally {
                if (isActive) {
                    setLoading(false);
                }
            }
        }

        fetchTickets();

        return () => {
            isActive = false;
        };
    }, [filters]);

    // Update search and filter values
    function updateFilter(event) {
        const { name, value } = event.target;

        setFilters((previous) => ({
            ...previous,
            [name]: value
        }));
    }

    return (
        <div className="dashboard-content">

            <h1>Triage Queue</h1>



            {/* Search and filters */}
            <div className="filter-bar">

                <input
                    type="text"
                    name="q"
                    value={filters.q}
                    onChange={updateFilter}
                    placeholder="Search tickets..."
                />

                <select
                    name="status"
                    value={filters.status}
                    onChange={updateFilter}
                >
                    <option value="">All statuses</option>
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                </select>

                <select
                    name="category"
                    value={filters.category}
                    onChange={updateFilter}
                >
                    <option value="">All categories</option>
                    <option value="BILLING">Billing</option>
                    <option value="BUG">Bug</option>
                    <option value="FEATURE_REQUEST">Feature Request</option>
                    <option value="LOGIN">Login</option>
                    <option value="DELIVERY">Delivery</option>
                </select>

                <select
                    name="priority"
                    value={filters.priority}
                    onChange={updateFilter}
                >
                    <option value="">All priorities</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                </select>

            </div>

            {/* Error message */}
            {error && (
                <p className="error-message">
                    {error}
                </p>
            )}

            {/* Loading state */}
            {loading ? (
                <p>Loading tickets...</p>

            ) : tickets.length === 0 ? (
                <p>No tickets found.</p>

            ) : (

                /* Ticket list */
                <div className="ticket-list">

                    {tickets.map((ticket) => (

                        <div
                            className="ticket-card"
                            key={ticket.id}
                        >

                            <h3>{ticket.subject}</h3>

                            <p>
                                <strong>Ticket ID:</strong>{" "}
                                {ticket.id}
                            </p>

                            <p>
                                <strong>Category:</strong>{" "}
                                {ticket.category}
                            </p>

                            <p>
                                <strong>Priority:</strong>{" "}
                                {ticket.priority}
                            </p>

                            <p>
                                <strong>Status:</strong>{" "}
                                {ticket.status}
                            </p>

                            <p>
                                <strong>Reviewed:</strong>{" "}
                                {ticket.isReviewed ? "Yes" : "No"}
                            </p>

                            <button
                                onClick={() =>
                                    navigate(`/tickets/${ticket.id}`)
                                }
                            >
                                Review Ticket
                            </button>

                        </div>

                    ))}

                </div>
            )}

        </div>
    );
}

export default TicketQueue;
