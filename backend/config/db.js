
const { Pool } = require("pg");

// Create a connection pool for PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Handle unexpected connection errors
pool.on("error", (error) => {
    console.error("Unexpected database error:", error.message);
});

module.exports = pool;
