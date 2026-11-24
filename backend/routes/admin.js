const express = require("express");
const pool = require("../config/db");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

// GET /api/admin/stats
router.get("/stats", authenticateToken, async (req, res) => {
    // Only admins can access dashboard statistics.
    if (req.user.role !== "ADMIN") {
        return res.status(403).json({
            error: {
                code: "FORBIDDEN",
                message: "Admin access is required"
            }
        });
    }

    try {
        // Count active resources.
        const resourceResult = await pool.query(
            "SELECT COUNT(*)::int AS count FROM resources WHERE is_active = true"
        );

        // Count bookings by status.
        const bookingResult = await pool.query(
            `SELECT status, COUNT(*)::int AS count
             FROM bookings
             GROUP BY status`
        );

        // Find the three most-booked resources.
        const topResourcesResult = await pool.query(
            `SELECT r.id AS "resourceId",
                    r.name,
                    COUNT(b.id)::int AS "bookingCount"
             FROM resources r
             LEFT JOIN bookings b ON b.resource_id = r.id
             GROUP BY r.id, r.name
             ORDER BY "bookingCount" DESC, r.name ASC
             LIMIT 3`
        );

        // Count tickets by status and category.
        const ticketStatusResult = await pool.query(
            `SELECT status, COUNT(*)::int AS count
             FROM tickets
             GROUP BY status`
        );

        const ticketCategoryResult = await pool.query(
            `SELECT category, COUNT(*)::int AS count
             FROM tickets
             GROUP BY category`
        );

        // Initialize every booking status to zero.
        const bookings = {
            PENDING: 0,
            APPROVED: 0,
            REJECTED: 0,
            CANCELLED: 0
        };

        bookingResult.rows.forEach((row) => {
            bookings[row.status] = row.count;
        });

        const ticketStats = {
            total: ticketStatusResult.rows.reduce(
                (sum, row) => sum + row.count,
                0
            ),
            byStatus: ticketStatusResult.rows,
            byCategory: ticketCategoryResult.rows
        };

        return res.status(200).json({
            activeResources: resourceResult.rows[0].count,
            bookings,
            topResources: topResourcesResult.rows,
            ticketStats
        });

    } catch (error) {
        console.error("Admin statistics error:", error.message);

        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to fetch admin statistics"
            }
        });
    }
});

module.exports = router;