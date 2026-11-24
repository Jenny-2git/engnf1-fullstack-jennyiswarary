
import { useState } from "react";
import api from "../services/api";

function TicketImport() {
    const [jsonText, setJsonText] = useState(
        JSON.stringify(
            {
                tickets: [
                    {
                        externalId: "EXT-1001",
                        subject: "Unable to log in",
                        body: "My password is not working."
                    },
                    {
                        externalId: "EXT-1002",
                        subject: "Refund not received",
                        body: "My payment refund has not arrived."
                    }
                ]
            },
            null,
            2
        )
    );

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState(null);

    async function handleImport(event) {
        event.preventDefault();
        setError("");
        setResult(null);

        let payload;

        try {
            payload = JSON.parse(jsonText);
        } catch {
            setError("Invalid JSON. Please check your input.");
            return;
        }

        if (!payload || !Array.isArray(payload.tickets) ||
            payload.tickets.length === 0) {
            setError("Provide a non-empty tickets array.");
            return;
        }

        setLoading(true);

        try {
            const response = await api.post("/tickets/import", payload);
            setResult(response.data);
        } catch (err) {
            setError(
                err.response?.data?.error?.message ||
                "Ticket import failed."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="page-container">
            <h1>Import Tickets</h1>
            <p>
                Submit ticket data as JSON. The backend classifies new tickets
                automatically and handles existing external IDs.
            </p>

            {error && <p className="error-message">{error}</p>}

            {result && (
                <section className="success-message">
                    <h3>Import completed</h3>
                    <pre>{JSON.stringify(result, null, 2)}</pre>
                </section>
            )}

            <form onSubmit={handleImport} className="ticket-detail-card">
                <label htmlFor="ticket-json">Ticket JSON</label>

                <textarea
                    id="ticket-json"
                    value={jsonText}
                    onChange={(event) => setJsonText(event.target.value)}
                    rows="16"
                    spellCheck="false"
                    required
                />

                <button type="submit" disabled={loading}>
                    {loading ? "Importing..." : "Import Tickets"}
                </button>
            </form>
        </main>
    );
}

export default TicketImport;
