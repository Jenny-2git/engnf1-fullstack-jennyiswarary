
import { useEffect, useState } from "react";
import api from "../services/api";

function AdminResources() {
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const [form, setForm] = useState({
        name: "",
        type: "ROOM",
        capacity: "",
        description: ""
    });

    useEffect(() => {
        let active = true;

        async function fetchResources() {
            try {
                const response = await api.get("/resources?limit=100");
                if (active) {
                    setResources(response.data.data || []);
                }
            } catch (err) {
                if (active) {
                    setError(
                        err.response?.data?.error?.message ||
                        "Unable to load resources."
                    );
                }
            } finally {
                if (active) setLoading(false);
            }
        }

        fetchResources();

        return () => {
            active = false;
        };
    }, []);

    function handleChange(event) {
        const { name, value } = event.target;
        setForm((previous) => ({
            ...previous,
            [name]: value
        }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");
        setMessage("");

        const capacity = Number(form.capacity);

        if (!form.name.trim() || !Number.isInteger(capacity) ||
            capacity < 1 || capacity > 500) {
            setError("Enter a resource name and a capacity between 1 and 500.");
            return;
        }

        setSaving(true);

        try {
            const response = await api.post("/resources", {
                name: form.name.trim(),
                type: form.type,
                capacity,
                description: form.description.trim()
            });

            const newResource = response.data.resource || response.data;
            setResources((previous) => [newResource, ...previous]);

            setForm({
                name: "",
                type: "ROOM",
                capacity: "",
                description: ""
            });

            setMessage("Resource added successfully.");
        } catch (err) {
            setError(
                err.response?.data?.error?.message ||
                "Unable to add resource."
            );
        } finally {
            setSaving(false);
        }
    }

    async function toggleResource(resource) {
        setError("");
        setMessage("");

        try {
            await api.patch(`/resources/${resource.id}`, {
                isActive: !resource.isActive
            });

            setResources((previous) =>
                previous.map((item) =>
                    item.id === resource.id
                        ? { ...item, isActive: !item.isActive }
                        : item
                )
            );

            setMessage("Resource status updated.");
        } catch (err) {
            setError(
                err.response?.data?.error?.message ||
                "Unable to update resource."
            );
        }
    }

    return (
        <main className="page-container">
            <h1>Resource Management</h1>

            {error && <p className="error-message">{error}</p>}
            {message && <p className="success-message">{message}</p>}

            <section className="ticket-detail-card">
                <h2>Add a Resource</h2>

                <form onSubmit={handleSubmit} className="review-form">
                    <label>
                        Resource name
                        <input
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            placeholder="e.g. Conference Room C"
                            required
                        />
                    </label>

                    <label>
                        Resource type
                        <select
                            name="type"
                            value={form.type}
                            onChange={handleChange}
                        >
                            <option value="ROOM">Room</option>
                            <option value="LAB">Lab</option>
                            <option value="EQUIPMENT">Equipment</option>
                        </select>
                    </label>

                    <label>
                        Capacity
                        <input
                            type="number"
                            name="capacity"
                            min="1"
                            max="500"
                            value={form.capacity}
                            onChange={handleChange}
                            placeholder="Enter capacity"
                            required
                        />
                    </label>

                    <label>
                        Description
                        <textarea
                            name="description"
                            value={form.description}
                            onChange={handleChange}
                            placeholder="Describe the resource"
                            rows="3"
                        />
                    </label>

                    <button type="submit" disabled={saving}>
                        {saving ? "Adding..." : "Add Resource"}
                    </button>
                </form>
            </section>

            <section className="ticket-detail-card">
                <h2>Existing Resources</h2>

                {loading ? (
                    <p>Loading resources...</p>
                ) : resources.length === 0 ? (
                    <p>No resources found.</p>
                ) : (
                    <div className="ticket-list">
                        {resources.map((resource) => (
                            <article className="ticket-card" key={resource.id}>
                                <h3>{resource.name}</h3>
                                <p>Type: {resource.type}</p>
                                <p>Capacity: {resource.capacity}</p>
                                <p>
                                    Status: {resource.isActive ? "Active" : "Inactive"}
                                </p>
                                <p>{resource.description}</p>

                                <button
                                    type="button"
                                    onClick={() => toggleResource(resource)}
                                >
                                    {resource.isActive ? "Deactivate" : "Activate"}
                                </button>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}

export default AdminResources;
