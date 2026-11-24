
import { useEffect, useState } from "react";
import api from "../services/api";

function MyBookings() {
    const [bookings, setBookings] = useState([]);
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState(null);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    // Fetch bookings whenever the selected status changes
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

                const response = await api.get("/bookings/mine", {
                    params
                });

                if (active) {
                    setBookings(response.data.data || response.data.bookings || []);
                }
            } catch (err) {
                console.error("Bookings loading error:", err);

                if (active) {
                    setError(
                        err.response?.data?.error?.message ||
                        "Unable to load bookings."
                    );
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }


        fetchBookings();

        return () => {
            active = false;
        };
    }, [status]);

    // Cancel a booking
    async function cancelBooking(id) {
        const confirmed = window.confirm(
            "Are you sure you want to cancel this booking?"
        );

        if (!confirmed) return;

        setError("");
        setMessage("");
        setCancelling(id);

        try {
            await api.patch(`/bookings/${id}/cancel`);

            setMessage("Booking cancelled successfully.");

            // Update the booking list without refreshing the page
            setBookings((previous) =>
                previous.map((booking) =>
                    String(booking.id) === String(id)
                        ? { ...booking, status: "CANCELLED" }
                        : booking
                )
            );

        } catch (err) {
            console.error("Booking cancellation error:", err);

            setError(
                err.response?.data?.error?.message ||
                "Unable to cancel booking."
            );

        } finally {
            setCancelling(null);
        }
    }

    return (
        <div className="dashboard-content">

            <h1>My Bookings</h1>

 

            {/* Booking status filter */}
            <div className="filter-bar">
                <select
                    value={status}
                    onChange={(e) => {
                        setStatus(e.target.value);
                        setMessage("");
                    }}
                >
                    <option value="">All bookings</option>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="CANCELLED">Cancelled</option>
                </select>
            </div>

            {/* Messages */}
            {error && (
                <p className="error-message">
                    {error}
                </p>
            )}

            {message && (
                <p className="success-message">
                    {message}
                </p>
            )}

            {/* Loading state */}
            {loading ? (
                <p>Loading bookings...</p>

            ) : bookings.length === 0 ? (
                <p>No bookings found.</p>

            ) : (

                /* Booking list */
                <div className="ticket-list">

                    {bookings.map((booking) => (

                        <div
                            className="ticket-card"
                            key={booking.id}
                        >

                            <h3>
                                {booking.resourceName ||
                                    `Resource #${booking.resourceId}`}
                            </h3>

                            <p>
                                <strong>Booking ID:</strong>{" "}
                                {booking.id}
                            </p>

                            <p>
                                <strong>Purpose:</strong>{" "}
                                {booking.purpose}
                            </p>

                            <p>
                                <strong>Start:</strong>{" "}
                                {new Date(
                                    booking.startTime
                                ).toLocaleString()}
                            </p>

                            <p>
                                <strong>End:</strong>{" "}
                                {new Date(
                                    booking.endTime
                                ).toLocaleString()}
                            </p>

                            <p>
                                <strong>Status:</strong>{" "}
                                {booking.status}
                            </p>

                            {(booking.status === "PENDING" ||
                                booking.status === "APPROVED") && (
                                <button
                                    onClick={() =>
                                        cancelBooking(booking.id)
                                    }
                                    disabled={cancelling === booking.id}
                                >
                                    {cancelling === booking.id
                                        ? "Cancelling..."
                                        : "Cancel Booking"}
                                </button>
                            )}

                        </div>

                    ))}

                </div>
            )}

        </div>
    );
}

export default MyBookings;
