
const express = require("express");
const pool = require("../config/db");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
    try {
        // Count tickets by category
        const categoryResult = await pool.query(
            `SELECT category, COUNT(*)::int AS count
             FROM tickets
             GROUP BY category
             ORDER BY category`
        );

        // Count tickets by priority
        const priorityResult = await pool.query(
            `SELECT priority, COUNT(*)::int AS count
             FROM tickets
             GROUP BY priority
             ORDER BY priority`
        );

        // Count tickets by status
        const statusResult = await pool.query(
            `SELECT status, COUNT(*)::int AS count
             FROM tickets
             GROUP BY status
             ORDER BY status`
        );

        // Count reviewed tickets
        const reviewedResult = await pool.query(
            `SELECT COUNT(*)::int AS count
             FROM tickets
             WHERE is_reviewed = TRUE`
        );

        // Calculate model agreement rate
        const agreementResult = await pool.query(
            `SELECT
                COUNT(*) FILTER (
                    WHERE auto_category = category
                )::int AS agreed,
                COUNT(*)::int AS total
             FROM tickets`
        );

        const agreed = agreementResult.rows[0].agreed;
        const total = agreementResult.rows[0].total;

        const modelAgreementRate = total === 0
            ? 0
            : Number(((agreed / total) * 100).toFixed(2));

        return res.status(200).json({
            byCategory: categoryResult.rows,
            byPriority: priorityResult.rows,
            byStatus: statusResult.rows,
            reviewedCount: reviewedResult.rows[0].count,
            modelAgreementRate
        });

    } catch (error) {
        console.error("Statistics error:", error.message);

        return res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Unable to retrieve dashboard statistics"
            }
        });
    }
});

module.exports = router;
