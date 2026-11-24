
import { Link, useNavigate } from "react-router-dom";

function Navbar() {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user") || "null");

    function handleLogout() {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    }

    return (
        <nav className="navbar">
            <Link to="/dashboard" className="navbar-brand">
                TriageSync
            </Link>

            <div className="navbar-links">
                <Link to="/dashboard">Dashboard</Link>
                <Link to="/tickets">Tickets</Link>
                <Link to="/resources">Resources</Link>
                <Link to="/my-bookings">My Bookings</Link>
                <Link to="/tickets/import">Import Tickets</Link>
                
                {user?.role === "ADMIN" && (
                    <>
                        <Link to="/admin/bookings">Manage Bookings</Link>
                        <Link to="/admin/resources">Manage Resources</Link>
                    </>
                )}

                <button type="button" onClick={handleLogout}>
                    Logout
                </button>
            </div>
        </nav>
    );
}

export default Navbar;
