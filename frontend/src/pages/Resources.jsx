import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

function Resources() {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user") || "null");

    const [resources, setResources] = useState([]);
    const [filters, setFilters] = useState({
        search: "",
        type: "",
        minCapacity: ""
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        async function loadResources() {
            setLoading(true);
            setError("");

            try {
                const params = new URLSearchParams();

                Object.entries(filters).forEach(([key, value]) => {
                    if (value) params.append(key, value);
                });

                const response = await api.get(
                    `/resources?${params.toString()}`
                );

                setResources(response.data.data || []);
            } catch (err) {
                setError(
                    err.response?.data?.error?.message ||
                    "Unable to load resources."
                );
            } finally {
                setLoading(false);
            }
        }

        loadResources();
    }, [filters]);

    function handleFilterChange(event) {
        setFilters({
            ...filters,
            [event.target.name]: event.target.value
        });
    }

    return (
        <div className="dashboard-content">
            <h1>Resource Management</h1>
            <p>Find available rooms, laboratories and equipment.</p>

            <div className="filter-bar">
                <input
                    name="search"
                    placeholder="Search resources..."
                    value={filters.search}
                    onChange={handleFilterChange}
                />

                <select
                    name="type"
                    value={filters.type}
                    onChange={handleFilterChange}
                >
                    <option value="">All types</option>
                    <option value="ROOM">Room</option>
                    <option value="LAB">Laboratory</option>
                    <option value="EQUIPMENT">Equipment</option>
                </select>

                <input
                    type="number"
                    name="minCapacity"
                    placeholder="Minimum capacity"
                    value={filters.minCapacity}
                    onChange={handleFilterChange}
                />
            </div>

            {error && <p className="error-message">{error}</p>}

            {loading ? (
                <p>Loading resources...</p>
            ) : resources.length === 0 ? (
                <p>No resources found.</p>
            ) : (
                <div className="ticket-list">
                    {resources.map((resource) => (
                        <div className="ticket-card" key={resource.id}>
                            <h3>{resource.name}</h3>
                            <p>Type: {resource.type}</p>
                            <p>Capacity: {resource.capacity}</p>
                            <p>{resource.description}</p>

                            <button
                                onClick={() =>
                                    navigate(`/resources/${resource.id}`)
                                }
                            >
                                View Availability
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {user?.role === "ADMIN" && (
                <button onClick={() => navigate("/admin/resources/new")}>
                    Add Resource
                </button>
            )}
        </div>
    );
}

export default Resources;