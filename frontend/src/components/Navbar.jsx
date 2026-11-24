import { Link, useNavigate, useLocation } from "react-router-dom";

function Navbar() {
    const navigate = useNavigate();
    const location = useLocation();

    const user = JSON.parse(localStorage.getItem("user") || "null");

    const isAdmin = user?.role === "ADMIN";

    function handleLogout() {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    }

    const navLinks = [
        { path: "/dashboard", label: "Dashboard" },
        { path: "/tickets", label: "Tickets" },
        { path: "/resources", label: "Resources"},
        { path: "/my-bookings", label: "My Bookings"},
    ];

    if (isAdmin) {
        navLinks.push(
            { path: "/tickets/import", label: "Import Tickets" },
            { path: "/admin/bookings", label: "Manage Bookings" },
            { path: "/admin/resources", label: "Manage Resources"}
        );
    }

    const initials = user?.name
        ? user.name.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase()
        : "U";

    return (
        <header className="app-header">
            <div className="navbar">
                <Link to="/dashboard" className="navbar-brand">
                    <span className="brand-icon">T</span>
                    <span>
                        Triage<span className="brand-highlight">Sync</span>
                    </span>
                </Link>

                <nav className="navbar-links">
                    {navLinks.map(link => (
                        <Link
                            key={link.path}
                            to={link.path}
                            className={
                                location.pathname === link.path ||
                                (link.path === "/tickets" && location.pathname.startsWith("/tickets/")) ||
                                (link.path === "/resources" && location.pathname.startsWith("/resources/"))
                                    ? "nav-link active"
                                    : "nav-link"
                            }
                        >
                            <span className="nav-icon">{link.icon}</span>
                            {link.label}
                        </Link>
                    ))}
                </nav>

                <div className="navbar-user">
                    <div className="user-avatar">{initials}</div>
                    <div className="user-info">
                        <strong>{user?.name || "User"}</strong>
                        <span>{user?.role || "Member"}</span>
                    </div>
                    <button
                        type="button"
                        className="logout-button"
                        onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </div>
        </header>
    );
}

export default Navbar;
