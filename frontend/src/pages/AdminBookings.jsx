
import { useEffect, useState } from "react";
import api from "../services/api";

function AdminBookings() {
    const [bookings, setBookings] = useState([]);
    const [status, setStatus] = useState("PENDING");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [processingId, setProcessingId] = useState(null);

    useEffect(() => {
        let active = true;

        async function fetchBookings() {
            setLoading(true);
            setError("");

            try {
                const params = {};

                if (status) {
                    params.status = status;
                }

                const response = await api.get("/bookings", { params });

                if (active) {
                    setBookings(response.data.data || response.data.bookings || []);
                }

            } catch (err) {
                if (active) {
                    setError(
                        err.response?.data?.error?.message ||
                        "Unable to load bookings."
                    );
                }
            } finally {
                if (active) setLoading(false);
            }
        }

        fetchBookings();

        return () => {
            active = false;
        };
    }, [status]);

    async function handleDecision(id, decision) {
        let note = "";

        if (decision === "reject") {
            note = window.prompt(
                "Enter the rejection reason (5–200 characters):"
            );

            if (note === null) return;

            if (note.trim().length < 5 || note.trim().length > 200) {
                setError("Rejection reason must be 5–200 characters.");
                return;
            }
        }

        setError("");
        setMessage("");
        setProcessingId(id);

        try {
            if (decision === "approve") {
                await api.patch(`/bookings/${id}/approve`);
                setMessage("Booking approved successfully.");
            } else {
                await api.patch(`/bookings/${id}/reject`, {
                    note: note.trim()
                });
                setMessage("Booking rejected successfully.");
            }

            setBookings((previous) =>
                previous.map((booking) =>
                    String(booking.id) === String(id)
                        ? {
                            ...booking,
                            status: decision === "approve"
                                ? "APPROVED"
                                : "REJECTED"
                        }
                        : booking
                )
            );
        } catch (err) {
            setError(
                err.response?.data?.error?.message ||
                "Unable to process booking."
            );
        } finally {
            setProcessingId(null);
        }
    }

    return (
        <div className="dashboard-content">
            <h1>Booking Management</h1>
            <p>Review and manage resource booking requests.</p>

            <div className="filter-bar">
                <select
                    value={status}
                    onChange={(e) => {
                        setStatus(e.target.value);
                        setMessage("");
                    }}
                >
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="CANCELLED">Cancelled</option>
                </select>
            </div>

            {error && <p className="error-message">{error}</p>}
            {message && <p className="success-message">{message}</p>}

            {loading ? (
                <p>Loading bookings...</p>
            ) : bookings.length === 0 ? (
                <p>No bookings found.</p>
            ) : (
                <div className="ticket-list">
                    {bookings.map((booking) => (
                        <div className="ticket-card" key={booking.id}>
                            <h3>
                                {booking.resourceName ||
                                    `Resource #${booking.resourceId}`}
                            </h3>

                            <p>
                                <strong>Booking ID:</strong> {booking.id}
                            </p>
                            <p>
                                <strong>User:</strong>{" "}
                                {booking.userName || booking.userId}
                            </p>
                            <p>
                                <strong>Purpose:</strong> {booking.purpose}
                            </p>
                            <p>
                                <strong>Start:</strong>{" "}
                                {new Date(booking.startTime).toLocaleString()}
                            </p>
                            <p>
                                <strong>End:</strong>{" "}
                                {new Date(booking.endTime).toLocaleString()}
                            </p>
                            <p>
                                <strong>Status:</strong> {booking.status}
                            </p>

                            {booking.status === "PENDING" && (
                                <div className="filter-bar">
                                    <button
                                        disabled={processingId === booking.id}
                                        onClick={() =>
                                            handleDecision(booking.id, "approve")
                                        }
                                    >
                                        Approve
                                    </button>

                                    <button
                                        disabled={processingId === booking.id}
                                        onClick={() =>
                                            handleDecision(booking.id, "reject")
                                        }
                                    >
                                        Reject
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default AdminBookings;
