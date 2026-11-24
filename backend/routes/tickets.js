
const express = require("express");
const pool = require("../config/db");
const authenticateToken = require("../middleware/auth");
const classifyTicket = require("../utils/ticketClassifier");

const router = express.Router();

router.post("/import", authenticateToken, async (req, res) => {

        if (req.user.role !== "ADMIN") {
        return res.status(403).json({
            error: {
                code: "FORBIDDEN",
                message: "Admin access is required"
            }
        });
    }
    
    const { tickets } = req.body;

    if (!Array.isArray(tickets) || tickets.length === 0) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Tickets must be a non-empty array"
            }
        });
    }

    const client = await pool.connect();

    let importedCount = 0;
    let updatedCount = 0;
    let skippedOverrideCount = 0;

    try {
        await client.query("BEGIN");

        for (const ticket of tickets) {
            const { externalId, subject, body } = ticket;

            if (
                typeof externalId !== "string" ||
                !externalId.trim() ||
                typeof subject !== "string" ||
                subject.trim().length < 3 ||
                subject.trim().length > 150 ||
                typeof body !== "string" ||
                body.trim().length < 5 ||
                body.trim().length > 2000
            ) {
                throw new Error("INVALID_TICKET_DATA");
            }

            const id = externalId.trim();
            const cleanSubject = subject.trim();
            const cleanBody = body.trim();

            const prediction = classifyTicket(cleanSubject, cleanBody);

            const existing = await client.query(
                "SELECT id, is_human_override FROM tickets WHERE external_id = $1",
                [id]
            );

            if (existing.rows.length === 0) {
                await client.query(
                    `INSERT INTO tickets
                    (external_id, subject, body, auto_category, category, priority)
                    VALUES ($1, $2, $3, $4, $4, $5)`,
                    [
                        id,
                        cleanSubject,
                        cleanBody,
                        prediction.category,
                        prediction.priority
                    ]
                );

                importedCount++;
            } else {
                const oldTicket = existing.rows[0];

                if (oldTicket.is_human_override) {
                    await client.query(
                        `UPDATE tickets
                         SET subject = $1, body = $2, updated_at = NOW()
                         WHERE id = $3`,
                        [cleanSubject, cleanBody, oldTicket.id]
                    );

                    skippedOverrideCount++;
                } else {
                    await client.query(
                        `UPDATE tickets
                         SET subject = $1,
                             body = $2,
                             auto_category = $3,
                             category = $3,
                             priority = $4,
                             updated_at = NOW()
                         WHERE id = $5`,
                        [
                            cleanSubject,
                            cleanBody,
                            prediction.category,
                            prediction.priority,
                            oldTicket.id
                        ]
                    );
                }

                updatedCount++;
            }
        }

        await client.query("COMMIT");

        return res.status(200).json({
            importedCount,
            updatedCount,
            skippedOverrideCount,
            total: tickets.length
        });

    } catch (error) {
        await client.query("ROLLBACK");

        if (error.message === "INVALID_TICKET_DATA") {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "One or more tickets have invalid data"
                }
            });
        }

        console.error("Ticket import error:", error.message);

        return res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Unable to import tickets"
            }
        });

    } finally {
        client.release();
    }
});


router.get("/", authenticateToken, async (req, res) => {
    try {
        const {
            status,
            category,
            priority,
            q = "",
            page = "1",
            limit = "10"
        } = req.query;

        // Validate pagination
        const currentPage = Number(page);
        const pageSize = Number(limit);

        if (
            !Number.isInteger(currentPage) ||
            !Number.isInteger(pageSize) ||
            currentPage < 1 ||
            pageSize < 1 ||
            pageSize > 100
        ) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid page or limit"
                }
            });
        }

        // Validate filters
        const allowedStatuses = [
            "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"
        ];

        const allowedCategories = [
            "BILLING", "BUG", "FEATURE_REQUEST",
            "LOGIN", "DELIVERY"
        ];

        const allowedPriorities = [
            "LOW", "MEDIUM", "HIGH", "URGENT"
        ];

        if (status && !allowedStatuses.includes(status)) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid status filter"
                }
            });
        }

        if (category && !allowedCategories.includes(category)) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid category filter"
                }
            });
        }

        if (priority && !allowedPriorities.includes(priority)) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid priority filter"
                }
            });
        }

        if (typeof q !== "string" || q.length > 200) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Search text is too long"
                }
            });
        }

        const conditions = [];
        const values = [];

        function addFilter(sql, value) {
            values.push(value);
            conditions.push(sql.replace("?", `$${values.length}`));
        }

        if (status) {
            addFilter("status = ?", status);
        }

        if (category) {
            addFilter("category = ?", category);
        }

        if (priority) {
            addFilter("priority = ?", priority);
        }

        if (q.trim()) {
            addFilter(
                "(subject ILIKE ? OR body ILIKE ? OR external_id ILIKE ?)",
                `%${q.trim()}%`
            );

            const searchParameter = values[values.length - 1];

            conditions[conditions.length - 1] =
                `(subject ILIKE $${values.length} OR body ILIKE $${values.length} OR external_id ILIKE $${values.length})`;

            values.push(searchParameter, searchParameter);

            const index = values.length - 2;

            conditions[conditions.length - 1] =
                `(subject ILIKE $${index} OR body ILIKE $${index + 1} OR external_id ILIKE $${index + 2})`;
        }

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM tickets ${whereClause}`,
            values
        );

        const total = Number(countResult.rows[0].count);
        const offset = (currentPage - 1) * pageSize;

        const dataResult = await pool.query(
            `SELECT
                id,
                external_id AS "externalId",
                subject,
                body,
                auto_category AS "autoCategory",
                category,
                is_human_override AS "isHumanOverride",
                priority,
                status,
                assignee_id AS "assigneeId",
                is_reviewed AS "isReviewed",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
             FROM tickets
             ${whereClause}
             ORDER BY created_at DESC
             LIMIT $${values.length + 1}
             OFFSET $${values.length + 2}`,
            [...values, pageSize, offset]
        );

        return res.status(200).json({
            data: dataResult.rows,
            page: currentPage,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
        });

    } catch (error) {
        console.error("Ticket listing error:", error.message);

        return res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Unable to retrieve tickets"
            }
        });
    }
});



router.get("/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ticket ID
        if (!/^\d+$/.test(id)) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Ticket not found"
                }
            });
        }

        // Fetch ticket details
        const ticketResult = await pool.query(
            `SELECT
                id,
                external_id AS "externalId",
                subject,
                body,
                auto_category AS "autoCategory",
                category,
                is_human_override AS "isHumanOverride",
                priority,
                status,
                assignee_id AS "assigneeId",
                is_reviewed AS "isReviewed",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
             FROM tickets
             WHERE id = $1`,
            [id]
        );

        if (ticketResult.rows.length === 0) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Ticket not found"
                }
            });
        }

        // Fetch ticket audit history
        const eventsResult = await pool.query(
            `SELECT
                id,
                ticket_id AS "ticketId",
                field,
                old_value AS "oldValue",
                new_value AS "newValue",
                actor,
                created_at AS "createdAt"
             FROM ticket_events
             WHERE ticket_id = $1
             ORDER BY created_at DESC`,
            [id]
        );

        return res.status(200).json({
            ticket: ticketResult.rows[0],
            events: eventsResult.rows
        });

    } catch (error) {
        console.error("Ticket detail error:", error.message);

        return res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Unable to retrieve ticket details"
            }
        });
    }
});



router.patch("/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;
    const allowedFields = ["category", "priority", "status", "assigneeId"];
    const client = await pool.connect();

    try {
        if (!/^\d+$/.test(id)) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Ticket not found"
                }
            });
        }

        const updates = req.body;

        if (
            !updates ||
            typeof updates !== "object" ||
            Array.isArray(updates) ||
            Object.keys(updates).length === 0 ||
            Object.keys(updates).some(key => !allowedFields.includes(key))
        ) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Provide valid ticket fields to update"
                }
            });
        }

        const categories = [
            "BILLING", "BUG", "FEATURE_REQUEST", "LOGIN", "DELIVERY"
        ];

        const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];

        const statuses = [
            "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"
        ];

        if (
            updates.category !== undefined &&
            !categories.includes(updates.category)
        ) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid category"
                }
            });
        }

        if (
            updates.priority !== undefined &&
            !priorities.includes(updates.priority)
        ) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid priority"
                }
            });
        }

        if (
            updates.status !== undefined &&
            !statuses.includes(updates.status)
        ) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid status"
                }
            });
        }

        if (
            updates.assigneeId !== undefined &&
            updates.assigneeId !== null &&
            (!/^[1-9]\d*$/.test(String(updates.assigneeId)))
        ) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid assignee ID"
                }
            });
        }

        await client.query("BEGIN");

        // Lock the ticket while updating it
        const ticketResult = await client.query(
            "SELECT * FROM tickets WHERE id = $1 FOR UPDATE",
            [id]
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

        const oldTicket = ticketResult.rows[0];

        // Check whether the assigned user exists
        if (
            updates.assigneeId !== undefined &&
            updates.assigneeId !== null
        ) {
            const userResult = await client.query(
                "SELECT id FROM users WHERE id = $1",
                [updates.assigneeId]
            );

            if (userResult.rows.length === 0) {
                await client.query("ROLLBACK");

                return res.status(404).json({
                    error: {
                        code: "NOT_FOUND",
                        message: "Assignee not found"
                    }
                });
            }
        }

        const fieldMap = {
            category: "category",
            priority: "priority",
            status: "status",
            assigneeId: "assignee_id"
        };

        const changes = [];
        const sqlValues = [];
        const assignments = [];

        for (const field of allowedFields) {
            if (updates[field] === undefined) continue;

            const column = fieldMap[field];
            const oldValue = oldTicket[column];
            const newValue = updates[field];

            if (String(oldValue ?? "") === String(newValue ?? "")) {
                continue;
            }

            changes.push({
                field,
                oldValue,
                newValue
            });

            sqlValues.push(newValue);
            assignments.push(`${column} = $${sqlValues.length}`);
        }

        if (changes.length > 0) {
            if (changes.some(change => change.field === "category")) {
                assignments.push("is_human_override = TRUE");
            }

            const statusChangedFromOpen = changes.some(
                change =>
                    change.field === "status" &&
                    oldTicket.status === "OPEN"
            );

            const categoryChanged = changes.some(
                change => change.field === "category"
            );

            if (categoryChanged || statusChangedFromOpen) {
                assignments.push("is_reviewed = TRUE");
            }

            assignments.push("updated_at = NOW()");

            sqlValues.push(id);

            await client.query(
                `UPDATE tickets
                 SET ${assignments.join(", ")}
                 WHERE id = $${sqlValues.length}`,
                sqlValues
            );

            const actor =
                req.get("X-Agent")?.trim() || req.user.email;

            for (const change of changes) {
                await client.query(
                    `INSERT INTO ticket_events
                     (ticket_id, field, old_value, new_value, actor)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        id,
                        change.field,
                        change.oldValue === null
                            ? null
                            : String(change.oldValue),
                        change.newValue === null
                            ? null
                            : String(change.newValue),
                        actor
                    ]
                );
            }
        }

        const updatedTicket = await client.query(
            `SELECT
                id,
                external_id AS "externalId",
                subject,
                body,
                auto_category AS "autoCategory",
                category,
                is_human_override AS "isHumanOverride",
                priority,
                status,
                assignee_id AS "assigneeId",
                is_reviewed AS "isReviewed",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
             FROM tickets
             WHERE id = $1`,
            [id]
        );

        const events = await client.query(
            `SELECT
                id,
                ticket_id AS "ticketId",
                field,
                old_value AS "oldValue",
                new_value AS "newValue",
                actor,
                created_at AS "createdAt"
             FROM ticket_events
             WHERE ticket_id = $1
             ORDER BY created_at DESC`,
            [id]
        );

        await client.query("COMMIT");

        return res.status(200).json({
            ticket: updatedTicket.rows[0],
            events: events.rows
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Ticket update error:", error.message);

        return res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Unable to update ticket"
            }
        });

    } finally {
        client.release();
    }
});


module.exports = router;
