
const express = require("express");
const pool = require("../config/db");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
    try {
        const {
            search = "",
            type,
            minCapacity,
            page = "1",
            limit = "10"
        } = req.query;

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
                    message: "Invalid pagination values"
                }
            });
        }

        const allowedTypes = ["ROOM", "LAB", "EQUIPMENT"];

        if (type && !allowedTypes.includes(type)) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid resource type"
                }
            });
        }

        if (
            typeof search !== "string" ||
            search.length > 100
        ) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid search text"
                }
            });
        }

        if (
            minCapacity !== undefined &&
            (!/^\d+$/.test(minCapacity) ||
                Number(minCapacity) < 1 ||
                Number(minCapacity) > 500)
        ) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid minimum capacity"
                }
            });
        }

        const conditions = [];
        const values = [];

        function addCondition(sql, value) {
            values.push(value);
            conditions.push(sql.replace("?", `$${values.length}`));
        }

        // Normal users can see only active resources
        if (req.user.role !== "ADMIN") {
            conditions.push("is_active = TRUE");
        }

        if (type) {
            addCondition("type = ?", type);
        }

        if (minCapacity !== undefined) {
            addCondition("capacity >= ?", Number(minCapacity));
        }

        if (search.trim()) {
            addCondition(
                "(name ILIKE ? OR description ILIKE ?)",
                `%${search.trim()}%`
            );

            const searchValue = values[values.length - 1];
            values.push(searchValue);

            conditions[conditions.length - 1] =
                `(name ILIKE $${values.length - 1} OR description ILIKE $${values.length})`;
        }

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM resources ${whereClause}`,
            values
        );

        const total = Number(countResult.rows[0].count);
        const offset = (currentPage - 1) * pageSize;

        const result = await pool.query(
            `SELECT
                id,
                name,
                type,
                capacity,
                description,
                is_active AS "isActive",
                created_at AS "createdAt"
             FROM resources
             ${whereClause}
             ORDER BY name ASC
             LIMIT $${values.length + 1}
             OFFSET $${values.length + 2}`,
            [...values, pageSize, offset]
        );

        return res.status(200).json({
            data: result.rows,
            page: currentPage,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
        });

    } catch (error) {
        console.error("Resource listing error:", error.message);

        return res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Unable to retrieve resources"
            }
        });
    }
});


router.get("/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        if (!/^\d+$/.test(id)) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Resource not found"
                }
            });
        }

        const result = await pool.query(
            `SELECT
                id,
                name,
                type,
                capacity,
                description,
                is_active AS "isActive",
                created_at AS "createdAt"
             FROM resources
             WHERE id = $1
             AND ($2 = 'ADMIN' OR is_active = TRUE)`,
            [id, req.user.role]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Resource not found"
                }
            });
        }

        return res.status(200).json({
            resource: result.rows[0]
        });

    } catch (error) {
        console.error("Resource detail error:", error.message);

        return res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Unable to retrieve resource"
            }
        });
    }
});



router.post("/", authenticateToken, async (req, res) => {
    try {
        // Check administrator role
        if (req.user.role !== "ADMIN") {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "Only administrators can create resources"
                }
            });
        }

        const { name, type, capacity, description } = req.body;

        const cleanName =
            typeof name === "string" ? name.trim() : "";

        const allowedTypes = ["ROOM", "LAB", "EQUIPMENT"];

        if (
            cleanName.length < 3 ||
            cleanName.length > 60 ||
            !allowedTypes.includes(type) ||
            !Number.isInteger(capacity) ||
            capacity < 1 ||
            capacity > 500 ||
            (description !== undefined &&
                description !== null &&
                (typeof description !== "string" ||
                    description.length > 300))
        ) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid resource details"
                }
            });
        }

        const result = await pool.query(
            `INSERT INTO resources
                (name, type, capacity, description)
             VALUES ($1, $2, $3, $4)
             RETURNING
                id,
                name,
                type,
                capacity,
                description,
                is_active AS "isActive",
                created_at AS "createdAt"`,
            [
                cleanName,
                type,
                capacity,
                description?.trim() || null
            ]
        );

        return res.status(201).json({
            resource: result.rows[0]
        });

    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "A resource with this name already exists"
                }
            });
        }

        console.error("Resource creation error:", error.message);

        return res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Unable to create resource"
            }
        });
    }
});


// PATCH /api/resources/:id - Update a resource (ADMIN only)
router.patch("/:id", authenticateToken, async (req, res) => {
    if (req.user.role !== "ADMIN") {
        return res.status(403).json({
            error: {
                code: "FORBIDDEN",
                message: "Only admins can update resources"
            }
        });
    }

    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Invalid resource ID"
            }
        });
    }

    const allowedFields = [
        "name",
        "type",
        "capacity",
        "description",
        "isActive"
    ];

    const updates = Object.keys(req.body);

    if (updates.length === 0 || updates.some(field => !allowedFields.includes(field))) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Provide valid resource fields to update"
            }
        });
    }

    const { name, type, capacity, description, isActive } = req.body;

    if (name !== undefined &&
        (typeof name !== "string" || name.trim().length < 3 || name.trim().length > 60)) {
        return res.status(400).json({
            error: { code: "VALIDATION_ERROR", message: "Name must be 3–60 characters" }
        });
    }

    if (type !== undefined &&
        !["ROOM", "LAB", "EQUIPMENT"].includes(type)) {
        return res.status(400).json({
            error: { code: "VALIDATION_ERROR", message: "Invalid resource type" }
        });
    }

    if (capacity !== undefined &&
        (!Number.isInteger(capacity) || capacity < 1 || capacity > 500)) {
        return res.status(400).json({
            error: { code: "VALIDATION_ERROR", message: "Capacity must be an integer from 1 to 500" }
        });
    }

    if (description !== undefined &&
        description !== null &&
        (typeof description !== "string" || description.length > 300)) {
        return res.status(400).json({
            error: { code: "VALIDATION_ERROR", message: "Description cannot exceed 300 characters" }
        });
    }

    if (isActive !== undefined && typeof isActive !== "boolean") {
        return res.status(400).json({
            error: { code: "VALIDATION_ERROR", message: "isActive must be true or false" }
        });
    }

    const columnMap = {
        name: "name",
        type: "type",
        capacity: "capacity",
        description: "description",
        isActive: "is_active"
    };

    const values = [];
    const setClauses = [];

    for (const field of updates) {
        let value = req.body[field];

        if (field === "name") {
            value = value.trim();
        }

        values.push(value);
        setClauses.push(`${columnMap[field]} = $${values.length}`);
    }

    values.push(id);

    try {
        const result = await pool.query(
            `UPDATE resources
             SET ${setClauses.join(", ")}
             WHERE id = $${values.length}
             RETURNING
                id,
                name,
                type,
                capacity,
                description,
                is_active AS "isActive",
                created_at AS "createdAt"`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: { code: "NOT_FOUND", message: "Resource not found" }
            });
        }

        return res.status(200).json({
            resource: result.rows[0]
        });

    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                error: { code: "CONFLICT", message: "A resource with this name already exists" }
            });
        }

        console.error("Resource update error:", error.message);

        return res.status(500).json({
            error: { code: "INTERNAL_ERROR", message: "Failed to update resource" }
        });
    }
});

// GET /api/resources/:id/availability
router.get("/:id/availability", authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { from, to } = req.query;

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Invalid resource ID"
            }
        });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (
        !from ||
        !to ||
        Number.isNaN(fromDate.getTime()) ||
        Number.isNaN(toDate.getTime()) ||
        fromDate.toISOString() !== from ||
        toDate.toISOString() !== to ||
        toDate <= fromDate ||
        toDate - fromDate > 7 * 24 * 60 * 60 * 1000
    ) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Provide valid UTC ISO timestamps covering at most 7 days"
            }
        });
    }

    try {
        // Check resource visibility
        const resourceResult = await pool.query(
            `SELECT id
             FROM resources
             WHERE id = $1
             AND ($2 = 'ADMIN' OR is_active = TRUE)`,
            [id, req.user.role]
        );

        if (resourceResult.rows.length === 0) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Resource not found"
                }
            });
        }

        // Find bookings that overlap the requested time range
        const result = await pool.query(
            `SELECT
                start_time AS "startTime",
                end_time AS "endTime",
                status
             FROM bookings
             WHERE resource_id = $1
             AND status IN ('PENDING', 'APPROVED')
             AND start_time < $3
             AND end_time > $2
             ORDER BY start_time ASC`,
            [id, from, to]
        );

        return res.status(200).json({
            resourceId: Number(id),
            from,
            to,
            bookings: result.rows
        });

    } catch (error) {
        console.error("Availability error:", error.message);

        return res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Could not retrieve resource availability"
            }
        });
    }
});

module.exports = router;
