
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";

function ResourceDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [resource, setResource] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [purpose, setPurpose] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        let active = true;

        async function loadResource() {
            setLoading(true);
            setError("");

            try {
                const response = await api.get(`/resources/${id}`);

                if (active) {
                    setResource(response.data.resource || response.data);
                }
            } catch (err) {
                if (active) {
                    setError(
                        err.response?.data?.error?.message ||
                        "Unable to load resource."
                    );
                }
            } finally {
                if (active) setLoading(false);
            }
        }

        loadResource();

        return () => {
            active = false;
        };
    }, [id]);

    async function checkAvailability(event) {
        event.preventDefault();
        setError("");
        setMessage("");
        setBookings([]);

        if (!from || !to) {
            setError("Please select both start and end times.");
            return;
        }

        try {
            const response = await api.get(
                `/resources/${id}/availability`,
                {
                    params: {
                        from: new Date(from).toISOString(),
                        to: new Date(to).toISOString()
                    }
                }
            );

            setBookings(response.data.bookings || []);
            setMessage("Availability information loaded.");
        } catch (err) {
            setError(
                err.response?.data?.error?.message ||
                "Unable to check availability."
            );
        }
    }

    async function createBooking(event) {
        event.preventDefault();
        setError("");
        setMessage("");

        try {
            await api.post("/bookings", {
                resourceId: Number(id),
                purpose,
                startTime: new Date(from).toISOString(),
                endTime: new Date(to).toISOString()
            });

            setMessage("Booking request submitted successfully.");
            setPurpose("");
            await checkAvailability(event);
        } catch (err) {
            setError(
                err.response?.data?.error?.message ||
                "Unable to create booking."
            );
        }
    }

    if (loading) return <p>Loading resource...</p>;

    if (!resource) {
        return (
            <div className="dashboard-content">
                <p>{error || "Resource not found."}</p>
                <button onClick={() => navigate("/resources")}>
                    Back to resources
                </button>
            </div>
        );
    }

    return (
        <div className="dashboard-content">
            <button onClick={() => navigate("/resources")}>
                ← Back to resources
            </button>

            <h1>{resource.name}</h1>

            <div className="ticket-detail-card">
                <p><strong>Type:</strong> {resource.type}</p>
                <p><strong>Capacity:</strong> {resource.capacity}</p>
                <p><strong>Description:</strong> {resource.description}</p>
                <p>
                    <strong>Status:</strong>{" "}
                    {resource.isActive ? "Active" : "Inactive"}
                </p>
            </div>

            <div className="ticket-detail-card">
                <h2>Check Availability</h2>

                {error && <p className="error-message">{error}</p>}
                {message && <p className="success-message">{message}</p>}

                <form onSubmit={checkAvailability} className="review-form">
                    <label>Start time</label>
                    <input
                        type="datetime-local"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        required
                    />

                    <label>End time</label>
                    <input
                        type="datetime-local"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        required
                    />

                    <button type="submit">Check Availability</button>
                </form>

                {bookings.length === 0 && message && (
                    <p>No conflicting bookings found for this period.</p>
                )}

                {bookings.map((booking) => (
                    <div className="audit-event" key={booking.id}>
                        <p>
                            {new Date(booking.startTime).toLocaleString()}
                            {" — "}
                            {new Date(booking.endTime).toLocaleString()}
                        </p>
                        <p>Status: {booking.status}</p>
                    </div>
                ))}
            </div>

            <div className="ticket-detail-card">
                <h2>Request a Booking</h2>

                <form onSubmit={createBooking} className="review-form">
                    <label>Purpose</label>
                    <input
                        type="text"
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        minLength={5}
                        maxLength={200}
                        placeholder="Explain why you need this resource"
                        required
                    />

                    <button type="submit">
                        Submit Booking Request
                    </button>
                </form>
            </div>
        </div>
    );
}

export default ResourceDetail;
