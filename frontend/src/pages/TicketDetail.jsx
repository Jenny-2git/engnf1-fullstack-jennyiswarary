
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

function TicketDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const token = localStorage.getItem("token");

    let userRole = "";

    if (token) {
        try {
            const payload = JSON.parse(
                atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
            );
            userRole = payload.role;
        } catch (error) {
            console.error("Unable to read user role:", error);
        }
    }

    const isAdmin = userRole === "ADMIN";
    const [ticket, setTicket] = useState(null);
    const [events, setEvents] = useState([]);
    const [category, setCategory] = useState("");
    const [priority, setPriority] = useState("");
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [agents, setAgents] = useState([]);
    const [assigneeId, setAssigneeId] = useState("");

    async function loadTicket() {
    setLoading(true);
    setError("");

    try {
        console.log("Loading ticket ID:", id);

        const response = await api.get(`/tickets/${id}`);

        if (isAdmin) {
            const agentsResponse = await api.get("/admin/agents");
            setAgents(agentsResponse.data.agents || []);
        } else {
            setAgents([]);
        }
        console.log("Ticket API response:", response.data);

        if (!response.data.ticket) {
            throw new Error("Ticket object is missing from API response.");
        }

        const ticketData = response.data.ticket;

        setTicket(ticketData);
        setAssigneeId(
            ticketData.assigneeId ? String(ticketData.assigneeId) : ""
        );
        setEvents(Array.isArray(response.data.events)
            ? response.data.events
            : []);

        setCategory(ticketData.category || "");
        setPriority(ticketData.priority || "");
        setStatus(ticketData.status || "");

    } catch (err) {
        console.error("Ticket detail error:", err);

        setError(
            err.response?.data?.error?.message ||
            err.message ||
            "Unable to load ticket."
        );
    } finally {
        setLoading(false);
    }
}

useEffect(() => {
    async function fetchTicket() {
        await loadTicket();
    }

    fetchTicket();
}, [id]);

    async function handleUpdate(event) {
        event.preventDefault();
        setSaving(true);
        setError("");
        setMessage("");

        try {
            const updateData = {
            category,
            priority,
            status
        };

        if (isAdmin) {
            updateData.assigneeId =
                assigneeId === "" ? null : Number(assigneeId);
        }

        await api.patch(`/tickets/${id}`, updateData);
            

            setMessage("Ticket updated successfully.");
            await loadTicket();
        } catch (err) {
            setError(
                err.response?.data?.error?.message ||
                "Unable to update ticket."
            );
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <p>Loading ticket details...</p>;
    }

    if (!ticket) {
        return (
            <div className="dashboard-content">
                <p>{error || "Ticket not found."}</p>
                <button onClick={() => navigate("/tickets")}>
                    Back to tickets
                </button>
            </div>
        );
    }

    return (
        <div className="dashboard-content">
            <button onClick={() => navigate("/tickets")}>
                ← Back to tickets
            </button>

            <h1>Ticket #{ticket.id}</h1>

            <div className="ticket-detail-card">
                <h2>{ticket.subject}</h2>
                <p>{ticket.body}</p>

                <div className="ticket-assignee-info">
                    <p>
                        <strong>Assigned To:</strong>{" "}
                        {ticket.assigneeName || "Unassigned"}
                    </p>

                    {ticket.assigneeEmail && (
                        <p>
                            <strong>Agent Email:</strong> {ticket.assigneeEmail}
                        </p>
                    )}
                </div>


                <p>
                    <strong>Automatically predicted category:</strong>{" "}
                    {ticket.autoCategory}
                </p>

                <p>
                    <strong>Human reviewed:</strong>{" "}
                    {ticket.isReviewed ? "Yes" : "No"}
                </p>

                <p>
                    <strong>Human override:</strong>{" "}
                    {ticket.isHumanOverride ? "Yes" : "No"}
                </p>
            </div>

            <div className="ticket-detail-card">
                <h2>Agent Review</h2>

                {error && <p className="error-message">{error}</p>}
                {message && <p className="success-message">{message}</p>}

                <form onSubmit={handleUpdate} className="review-form">
                    <label>Category</label>
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                    >
                        <option value="BILLING">Billing</option>
                        <option value="BUG">Bug</option>
                        <option value="FEATURE_REQUEST">Feature Request</option>
                        <option value="LOGIN">Login</option>
                        <option value="DELIVERY">Delivery</option>
                    </select>
                    <label>Assign To</label>
                    <select
                        value={assigneeId}
                        onChange={(e) => setAssigneeId(e.target.value)}
                    >
                        <option value="">Unassigned</option>

                        {agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                                {agent.name} ({agent.email})
                            </option>
                        ))}
                    </select>
                    <label>Priority</label>
                    <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                    >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                    </select>

                    <label>Status</label>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="CLOSED">Closed</option>
                    </select>

                    <button type="submit" disabled={saving}>
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </form>
            </div>

            <div className="ticket-detail-card">
                <h2>Audit History</h2>

                {events.length === 0 ? (
                    <p>No changes recorded yet.</p>
                ) : (
                    events.map((event, index) => (
                        <div className="audit-event" key={event.id || index}>
                            <p>
                                <strong>
                                    {event.fieldName || event.field || "Updated field"}
                                </strong>
                            </p>

                            <p>
                                {event.oldValue ?? "—"} → {event.newValue ?? "—"}
                            </p>

                            <small>
                                By: {event.actor || "Unknown"} |{" "}
                                {event.createdAt
                                    ? new Date(event.createdAt).toLocaleString()
                                    : ""}
                            </small>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default TicketDetail;
