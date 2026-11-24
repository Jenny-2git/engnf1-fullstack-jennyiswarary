
require("dotenv").config({
    path: require("path").resolve(__dirname, "../.env")
});

const bcrypt = require("bcryptjs");
const pool = require("../config/db");

const users = [
    {
        name: "Triage Admin",
        email: "admin@triagesync.test",
        password: "Admin@123",
        role: "ADMIN"
    },
    {
        name: "Demo User",
        email: "user@triagesync.test",
        password: "User@123",
        role: "USER"
    }
];

const resources = [
    {
        name: "Conference Room A",
        type: "ROOM",
        capacity: 12,
        description: "Main meeting room",
        isActive: true
    },
    {
        name: "Conference Room B",
        type: "ROOM",
        capacity: 8,
        description: "Small meeting room",
        isActive: true
    },
    {
        name: "Computer Lab 1",
        type: "LAB",
        capacity: 30,
        description: "Development computer lab",
        isActive: true
    },
    {
        name: "Computer Lab 2",
        type: "LAB",
        capacity: 25,
        description: "Testing and training lab",
        isActive: true
    },
    {
        name: "Projector",
        type: "EQUIPMENT",
        capacity: 1,
        description: "Portable meeting projector",
        isActive: true
    },
    {
        name: "Laptop Kit",
        type: "EQUIPMENT",
        capacity: 5,
        description: "Shared laptop equipment kit",
        isActive: false
    }
];

const tickets = [
    {
        externalId: "T-1001",
        subject: "Refund not received",
        body: "My refund has not arrived after seven days.",
        category: "BILLING",
        priority: "HIGH",
        status: "OPEN",
        reviewed: true
    },
    {
        externalId: "T-1002",
        subject: "Invoice has incorrect amount",
        body: "The invoice shows an incorrect payment amount.",
        category: "BILLING",
        priority: "MEDIUM",
        status: "IN_PROGRESS",
        reviewed: true
    },
    {
        externalId: "T-1003",
        subject: "Charged twice for subscription",
        body: "I was charged twice for the same subscription.",
        category: "BILLING",
        priority: "URGENT",
        status: "OPEN",
        reviewed: false
    },
    {
        externalId: "T-1004",
        subject: "Application crashes on startup",
        body: "The application crashes whenever I open it.",
        category: "BUG",
        priority: "HIGH",
        status: "OPEN",
        reviewed: false
    },
    {
        externalId: "T-1005",
        subject: "Server error 500",
        body: "I receive a 500 error when submitting the form.",
        category: "BUG",
        priority: "URGENT",
        status: "IN_PROGRESS",
        reviewed: true
    },
    {
        externalId: "T-1006",
        subject: "Search feature is broken",
        body: "Search results do not appear correctly.",
        category: "BUG",
        priority: "MEDIUM",
        status: "RESOLVED",
        reviewed: false
    },
    {
        externalId: "T-1007",
        subject: "Please add dark mode",
        body: "I would like a dark mode option in the dashboard.",
        category: "FEATURE_REQUEST",
        priority: "LOW",
        status: "OPEN",
        reviewed: false
    },
    {
        externalId: "T-1008",
        subject: "Export reports to PDF",
        body: "Please add an option to export reports as PDF.",
        category: "FEATURE_REQUEST",
        priority: "MEDIUM",
        status: "OPEN",
        reviewed: false
    },
    {
        externalId: "T-1009",
        subject: "Cannot sign in to account",
        body: "My password is correct but I cannot sign in.",
        category: "LOGIN",
        priority: "HIGH",
        status: "IN_PROGRESS",
        reviewed: false
    },
    {
        externalId: "T-1010",
        subject: "Password reset not working",
        body: "The password reset link is not working.",
        category: "LOGIN",
        priority: "MEDIUM",
        status: "OPEN",
        reviewed: false
    },
    {
        externalId: "T-1011",
        subject: "Account locked out",
        body: "I am locked out and cannot access my account.",
        category: "LOGIN",
        priority: "URGENT",
        status: "OPEN",
        reviewed: false
    },
    {
        externalId: "T-1012",
        subject: "Package has not arrived",
        body: "My package has not arrived yet.",
        category: "DELIVERY",
        priority: "HIGH",
        status: "OPEN",
        reviewed: false
    },
    {
        externalId: "T-1013",
        subject: "Tracking information unavailable",
        body: "The tracking page does not show my shipment.",
        category: "DELIVERY",
        priority: "MEDIUM",
        status: "RESOLVED",
        reviewed: false
    },
    {
        externalId: "T-1014",
        subject: "Delivery address update",
        body: "I need to update the delivery address.",
        category: "DELIVERY",
        priority: "LOW",
        status: "CLOSED",
        reviewed: false
    },
    {
        externalId: "T-1015",
        subject: "<script>alert('XSS')</script>",
        body: "Please display this text safely: <img src=x onerror=alert(1)>",
        category: "BUG",
        priority: "LOW",
        status: "OPEN",
        reviewed: false
    }
];

async function seedDatabase() {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Create demo users with hashed passwords.
        for (const user of users) {
            const passwordHash = await bcrypt.hash(user.password, 10);

            await client.query(
                `INSERT INTO users (name, email, password_hash, role)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (email)
                 DO UPDATE SET
                    name = EXCLUDED.name,
                    password_hash = EXCLUDED.password_hash,
                    role = EXCLUDED.role`,
                [user.name, user.email.toLowerCase(), passwordHash, user.role]
            );
        }

        // Insert or update resources.
        for (const resource of resources) {
            await client.query(
                `INSERT INTO resources
                    (name, type, capacity, description, is_active)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (name)
                 DO UPDATE SET
                    type = EXCLUDED.type,
                    capacity = EXCLUDED.capacity,
                    description = EXCLUDED.description,
                    is_active = EXCLUDED.is_active`,
                [
                    resource.name,
                    resource.type,
                    resource.capacity,
                    resource.description,
                    resource.isActive
                ]
            );
        }

        // Insert tickets without duplicating existing external IDs.
        for (const ticket of tickets) {
            await client.query(
                `INSERT INTO tickets
                    (external_id, subject, body, auto_category,
                     category, priority, status, is_reviewed)
                 VALUES ($1, $2, $3, $4, $4, $5, $6, $7)
                 ON CONFLICT (external_id) DO NOTHING`,
                [
                    ticket.externalId,
                    ticket.subject,
                    ticket.body,
                    ticket.category,
                    ticket.priority,
                    ticket.status,
                    ticket.reviewed
                ]
            );
        }

        await client.query("COMMIT");

        console.log("Database seeding completed successfully!");
        console.log("Demo admin: admin@triagesync.test");
        console.log("Demo user: user@triagesync.test");
        console.log("Resources configured:", resources.length);
        console.log("Tickets configured:", tickets.length);

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Seeding failed:", error.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

seedDatabase();
