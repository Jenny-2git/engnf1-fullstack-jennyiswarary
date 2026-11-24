const express = require("express");
const router = express.Router();

const pool = require("../config/db");
const authenticateToken = require("../middleware/auth");

// POST /api/bookings - Create a booking
router.post("/", authenticateToken, async (req, res) => {
    const { resourceId, startTime, endTime, purpose, ticketId } = req.body;

    // 1. Validate required fields
    if (
        !resourceId ||
        !startTime ||
        !endTime ||
        typeof purpose !== "string"
    ) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Resource, start time, end time and purpose are required"
            }
        });
    }

    // 2. Validate resource ID
    if (!Number.isInteger(Number(resourceId)) || Number(resourceId) <= 0) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Invalid resource ID"
            }
        });
    }

    // 3. Validate purpose
    const cleanPurpose = purpose.trim();

    if (cleanPurpose.length < 5 || cleanPurpose.length > 200) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Purpose must be between 5 and 200 characters"
            }
        });
    }

    // 4. Validate UTC ISO timestamps
    const isoPattern =
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/;

    if (
        typeof startTime !== "string" ||
        typeof endTime !== "string" ||
        !isoPattern.test(startTime) ||
        !isoPattern.test(endTime)
    ) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Times must be UTC ISO timestamps with zero seconds and milliseconds"
            }
        });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        start.toISOString() !== startTime ||
        end.toISOString() !== endTime
    ) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Invalid date or time"
            }
        });
    }

    // 5. Start time must be on a 30-minute boundary
    if (
        ![0, 30].includes(start.getUTCMinutes()) ||
        start.getUTCSeconds() !== 0 ||
        start.getUTCMilliseconds() !== 0 ||
        ![0, 30].includes(end.getUTCMinutes()) ||
        end.getUTCSeconds() !== 0 ||
        end.getUTCMilliseconds() !== 0
    ) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Booking times must use 30-minute intervals"
            }
        });
    }

    // 6. Validate duration
    const durationMinutes = (end - start) / 60000;

    if (durationMinutes < 30 || durationMinutes > 240) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Booking duration must be between 30 and 240 minutes"
            }
        });
    }

    // 7. Validate booking date range
    const now = new Date();
    const maximumDate = new Date(
        now.getTime() + 30 * 24 * 60 * 60 * 1000
    );

    if (start <= now || start > maximumDate) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Start time must be in the future and within 30 days"
            }
        });
    }

    // 8. Validate optional ticket ID
    if (
        ticketId !== undefined &&
        ticketId !== null &&
        (!Number.isInteger(Number(ticketId)) || Number(ticketId) <= 0)
    ) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Invalid ticket ID"
            }
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 9. Lock the resource row.
        // Other booking requests for this resource must wait until
        // this transaction finishes.
        const resourceResult = await client.query(
            `SELECT id, is_active
             FROM resources
             WHERE id = $1
             FOR UPDATE`,
            [resourceId]
        );

        if (resourceResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Resource not found"
                }
            });
        }

        if (!resourceResult.rows[0].is_active) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "This resource is inactive"
                }
            });
        }

        // 10. Check optional ticket existence
        if (ticketId !== undefined && ticketId !== null) {
            const ticketResult = await client.query(
                "SELECT id FROM tickets WHERE id = $1",
                [ticketId]
            );

            if (ticketResult.rows.length === 0) {
                await client.query("ROLLBACK");

                return res.status(404).json({
                    error: {
                        code: "NOT_FOUND",
                        message: "Ticket not found"
                    }
                });
            }
        }

        // 11. Maximum three future active bookings per user

        // Lock the user's row to protect the three-booking limit
        await client.query(
            "SELECT id FROM users WHERE id = $1 FOR UPDATE",
            [req.user.id]
        );
        
        const userBookings = await client.query(
            `SELECT COUNT(*)::int AS count
             FROM bookings
             WHERE user_id = $1
             AND status IN ('PENDING', 'APPROVED')
             AND start_time > NOW()`,
            [req.user.id]
        );

        if (userBookings.rows[0].count >= 3) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "You already have three future active bookings"
                }
            });
        }

        // 12. Check overlapping bookings
        const overlapResult = await client.query(
            `SELECT id
             FROM bookings
             WHERE resource_id = $1
             AND status IN ('PENDING', 'APPROVED')
             AND start_time < $3
             AND end_time > $2
             LIMIT 1`,
            [resourceId, startTime, endTime]
        );

        if (overlapResult.rows.length > 0) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "This resource is already booked during that time"
                }
            });
        }

        // 13. Create the booking
        const bookingResult = await client.query(
            `INSERT INTO bookings
                (resource_id, user_id, ticket_id, start_time,
                 end_time, purpose, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
             RETURNING
                id,
                resource_id AS "resourceId",
                user_id AS "userId",
                ticket_id AS "ticketId",
                start_time AS "startTime",
                end_time AS "endTime",
                purpose,
                status,
                created_at AS "createdAt"`,
            [
                resourceId,
                req.user.id,
                ticketId ?? null,
                startTime,
                endTime,
                cleanPurpose
            ]
        );

        await client.query("COMMIT");

        return res.status(201).json({
            booking: bookingResult.rows[0]
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Booking creation error:", error.message);

        return res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Could not create booking"
            }
        });

    } finally {
        client.release();
    }
});


// GET /api/bookings/mine - Get current user's bookings
router.get("/mine", authenticateToken, async (req, res) => {
    const { status } = req.query;

    const allowedStatuses = [
        "PENDING",
        "APPROVED",
        "REJECTED",
        "CANCELLED"
    ];

    const page = Number.parseInt(req.query.page ?? "1", 10);
    const limit = Number.parseInt(req.query.limit ?? "10", 10);

    if (
        !Number.isInteger(page) ||
        !Number.isInteger(limit) ||
        page < 1 ||
        limit < 1 ||
        limit > 100
    ) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Invalid pagination values"
            }
        });
    }

    if (status && !allowedStatuses.includes(status)) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Invalid booking status"
            }
        });
    }

    try {
        const values = [req.user.id];
        let whereClause = "WHERE user_id = $1";

        if (status) {
            values.push(status);
            whereClause += ` AND status = $${values.length}`;
        }

        const countResult = await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM bookings
             ${whereClause}`,
            values
        );

        const total = countResult.rows[0].total;
        const offset = (page - 1) * limit;

        const dataValues = [...values, limit, offset];

        const result = await pool.query(
            `SELECT
                id,
                resource_id AS "resourceId",
                user_id AS "userId",
                ticket_id AS "ticketId",
                start_time AS "startTime",
                end_time AS "endTime",
                purpose,
                status,
                decision_note AS "decisionNote",
                created_at AS "createdAt"
             FROM bookings
             ${whereClause}
             ORDER BY start_time DESC
             LIMIT $${values.length + 1}
             OFFSET $${values.length + 2}`,
            dataValues
        );

        return res.status(200).json({
            data: result.rows,
            page,
            pageSize: limit,
            total,
            totalPages: Math.ceil(total / limit)
        });

    } catch (error) {
        console.error("My bookings error:", error.message);

        return res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Could not retrieve bookings"
            }
        });
    }
});

// GET /api/bookings/:id - Get booking details
router.get("/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;

    if (!/^\d+$/.test(id) || Number(id) <= 0) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Invalid booking ID"
            }
        });
    }

    try {
        const result = await pool.query(
            `SELECT
                id,
                resource_id AS "resourceId",
                user_id AS "userId",
                ticket_id AS "ticketId",
                start_time AS "startTime",
                end_time AS "endTime",
                purpose,
                status,
                decision_note AS "decisionNote",
                created_at AS "createdAt"
             FROM bookings
             WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Booking not found"
                }
            });
        }

        const booking = result.rows[0];

        // Admins can view all bookings.
        // Regular users can view only their own.
        if (
            req.user.role !== "ADMIN" &&
            Number(booking.userId) !== Number(req.user.id)
        ) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You cannot view another user's booking"
                }
            });
        }

        return res.status(200).json({ booking });

    } catch (error) {
        console.error("Get booking error:", error.message);

        return res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Could not retrieve booking"
            }
        });
    }
});

// GET /api/bookings - Admin booking list
router.get("/", authenticateToken, async (req, res) => {
    if (req.user.role !== "ADMIN") {
        return res.status(403).json({
            error: {
                code: "FORBIDDEN",
                message: "Only admins can view all bookings"
            }
        });
    }

    const { status, resourceId, from, to } = req.query;

    const allowedStatuses = [
        "PENDING",
        "APPROVED",
        "REJECTED",
        "CANCELLED"
    ];

    const page = Number.parseInt(req.query.page ?? "1", 10);
    const limit = Number.parseInt(req.query.limit ?? "10", 10);

    if (
        page < 1 || limit < 1 || limit > 100 ||
        !Number.isInteger(page) || !Number.isInteger(limit)
    ) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Invalid pagination values"
            }
        });
    }

    if (status && !allowedStatuses.includes(status)) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Invalid booking status"
            }
        });
    }

    if (
        resourceId !== undefined &&
        (!/^\d+$/.test(resourceId) || Number(resourceId) <= 0)
    ) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Invalid resource ID"
            }
        });
    }

    const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

    if (
        (from && (!isoPattern.test(from) || Number.isNaN(Date.parse(from)) || new Date(from).toISOString() !== from)) ||
        (to && (!isoPattern.test(to) || Number.isNaN(Date.parse(to)) || new Date(to).toISOString() !== to)) ||
        (from && to && new Date(to) <= new Date(from))
    ) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Provide valid UTC date filters with from earlier than to"
            }
        });
    }

    try {
        const conditions = [];
        const values = [];

        if (status) {
            values.push(status);
            conditions.push(`status = $${values.length}`);
        }

        if (resourceId) {
            values.push(resourceId);
            conditions.push(`resource_id = $${values.length}`);
        }

        if (from) {
            values.push(from);
            conditions.push(`start_time >= $${values.length}`);
        }

        if (to) {
            values.push(to);
            conditions.push(`start_time < $${values.length}`);
        }

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const countResult = await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM bookings
             ${whereClause}`,
            values
        );

        const total = countResult.rows[0].total;
        const offset = (page - 1) * limit;

        const result = await pool.query(
            `SELECT
                id,
                resource_id AS "resourceId",
                user_id AS "userId",
                ticket_id AS "ticketId",
                start_time AS "startTime",
                end_time AS "endTime",
                purpose,
                status,
                decision_note AS "decisionNote",
                created_at AS "createdAt"
             FROM bookings
             ${whereClause}
             ORDER BY start_time DESC
             LIMIT $${values.length + 1}
             OFFSET $${values.length + 2}`,
            [...values, limit, offset]
        );

        return res.status(200).json({
            data: result.rows,
            page,
            pageSize: limit,
            total,
            totalPages: Math.ceil(total / limit)
        });

    } catch (error) {
        console.error("Admin bookings error:", error.message);

        return res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Could not retrieve bookings"
            }
        });
    }
});

// PATCH /api/bookings/:id/cancel
router.patch("/:id/cancel", authenticateToken, async (req, res) => {
    const { id } = req.params;

    if (!/^\d+$/.test(id) || Number(id) <= 0) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Invalid booking ID"
            }
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Find and lock the booking
        const result = await client.query(
            `SELECT id, user_id, status, start_time
             FROM bookings
             WHERE id = $1
             FOR UPDATE`,
            [id]
        );

        if (result.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Booking not found"
                }
            });
        }

        const booking = result.rows[0];

        // Check ownership
        if (
            req.user.role !== "ADMIN" &&
            Number(booking.user_id) !== Number(req.user.id)
        ) {
            await client.query("ROLLBACK");

            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You cannot cancel another user's booking"
                }
            });
        }

        // Check booking status
        if (!["PENDING", "APPROVED"].includes(booking.status)) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "This booking cannot be cancelled"
                }
            });
        }

        // Only future bookings can be cancelled
        if (new Date(booking.start_time) <= new Date()) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "A booking that has already started cannot be cancelled"
                }
            });
        }

        // Update status
        const updated = await client.query(
            `UPDATE bookings
             SET status = 'CANCELLED'
             WHERE id = $1
             RETURNING
                id,
                resource_id AS "resourceId",
                user_id AS "userId",
                ticket_id AS "ticketId",
                start_time AS "startTime",
                end_time AS "endTime",
                purpose,
                status,
                decision_note AS "decisionNote",
                created_at AS "createdAt"`,
            [id]
        );

        await client.query("COMMIT");

        return res.status(200).json({
            booking: updated.rows[0]
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Cancel booking error:", error.message);

        return res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Could not cancel booking"
            }
        });

    } finally {
        client.release();
    }
});

// PATCH /api/bookings/:id/approve
router.patch("/:id/approve", authenticateToken, async (req, res) => {
    // Only admins can approve bookings
    if (req.user.role !== "ADMIN") {
        return res.status(403).json({
            error: {
                code: "FORBIDDEN",
                message: "Only admins can approve bookings"
            }
        });
    }

    const { id } = req.params;

    if (!/^\d+$/.test(id) || Number(id) <= 0) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Invalid booking ID"
            }
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Lock the booking row
        const result = await client.query(
            `SELECT id, status, start_time
             FROM bookings
             WHERE id = $1
             FOR UPDATE`,
            [id]
        );

        if (result.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Booking not found"
                }
            });
        }

        const booking = result.rows[0];

        // Only PENDING bookings can be approved
        if (booking.status !== "PENDING") {
            await client.query("ROLLBACK");

            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "Only pending bookings can be approved"
                }
            });
        }

        // Booking must still be in the future
        if (new Date(booking.start_time) <= new Date()) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "Past or started bookings cannot be approved"
                }
            });
        }

        const updated = await client.query(
            `UPDATE bookings
             SET status = 'APPROVED'
             WHERE id = $1
             RETURNING
                id,
                resource_id AS "resourceId",
                user_id AS "userId",
                ticket_id AS "ticketId",
                start_time AS "startTime",
                end_time AS "endTime",
                purpose,
                status,
                decision_note AS "decisionNote",
                created_at AS "createdAt"`,
            [id]
        );

        await client.query("COMMIT");

        return res.status(200).json({
            booking: updated.rows[0]
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Approve booking error:", error.message);

        return res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Could not approve booking"
            }
        });

    } finally {
        client.release();
    }
});

// PATCH /api/bookings/:id/reject
router.patch("/:id/reject", authenticateToken, async (req, res) => {
    // Only admins can reject bookings
    if (req.user.role !== "ADMIN") {
        return res.status(403).json({
            error: {
                code: "FORBIDDEN",
                message: "Only admins can reject bookings"
            }
        });
    }

    const { id } = req.params;
    const { note } = req.body;

    if (!/^\d+$/.test(id) || Number(id) <= 0) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Invalid booking ID"
            }
        });
    }

    // Validate rejection note
    if (
        typeof note !== "string" ||
        note.trim().length < 5 ||
        note.trim().length > 200
    ) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Rejection note must be between 5 and 200 characters"
            }
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Lock booking row
        const result = await client.query(
            `SELECT id, status, start_time
             FROM bookings
             WHERE id = $1
             FOR UPDATE`,
            [id]
        );

        if (result.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Booking not found"
                }
            });
        }

        const booking = result.rows[0];

        // Only pending bookings can be rejected
        if (booking.status !== "PENDING") {
            await client.query("ROLLBACK");

            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "Only pending bookings can be rejected"
                }
            });
        }

        // Booking must still be in the future
        if (new Date(booking.start_time) <= new Date()) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "Past or started bookings cannot be rejected"
                }
            });
        }

        // Update booking
        const updated = await client.query(
            `UPDATE bookings
             SET status = 'REJECTED',
                 decision_note = $2
             WHERE id = $1
             RETURNING
                id,
                resource_id AS "resourceId",
                user_id AS "userId",
                ticket_id AS "ticketId",
                start_time AS "startTime",
                end_time AS "endTime",
                purpose,
                status,
                decision_note AS "decisionNote",
                created_at AS "createdAt"`,
            [id, note.trim()]
        );

        await client.query("COMMIT");

        return res.status(200).json({
            booking: updated.rows[0]
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Reject booking error:", error.message);

        return res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Could not reject booking"
            }
        });

    } finally {
        client.release();
    }
});

module.exports = router;