
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

// REGISTER
router.post("/register", async (req, res) => {
    try {
        let { name, email, password } = req.body;

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Name, email and password are required"
                }
            });
        }

        name = name.trim();
        email = email.trim().toLowerCase();

        if (name.length < 2 || name.length > 50) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Name must contain 2 to 50 characters"
                }
            });
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (email.length > 254 || !emailPattern.test(email)) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Enter a valid email address"
                }
            });
        }

        if (
            password.length < 8 ||
            password.length > 64 ||
            !/[A-Za-z]/.test(password) ||
            !/[0-9]/.test(password)
        ) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Password must be 8-64 characters and contain a letter and a number"
                }
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (name, email, password_hash, role)
             VALUES ($1, $2, $3, 'USER')
             RETURNING id, name, email, role, created_at`,
            [name, email, passwordHash]
        );

        res.status(201).json({
            user: result.rows[0]
        });

    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                error: {
                    code: "CONFLICT",
                    message: "Email address already registered"
                }
            });
        }

        console.error("Registration error:", error.message);

        res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Unable to register user"
            }
        });
    }
});


// LOGIN
router.post("/login", async (req, res) => {
    try {
        let { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Email and password are required"
                }
            });
        }

        email = email.trim().toLowerCase();

        const result = await pool.query(
            `SELECT id, name, email, password_hash, role
             FROM users
             WHERE LOWER(email) = $1`,
            [email]
        );

        const user = result.rows[0];

        if (
            !user ||
            !(await bcrypt.compare(password, user.password_hash))
        ) {
            return res.status(401).json({
                error: {
                    code: "UNAUTHENTICATED",
                    message: "Invalid email or password"
                }
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        res.status(200).json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login error:", error.message);

        res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Unable to log in"
            }
        });
    }
});


// CURRENT LOGGED-IN USER
router.get("/me", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, email, role, created_at
             FROM users
             WHERE id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                error: {
                    code: "UNAUTHENTICATED",
                    message: "User account no longer exists"
                }
            });
        }

        res.status(200).json({
            user: result.rows[0]
        });

    } catch (error) {
        console.error("User lookup error:", error.message);

        res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Unable to retrieve user"
            }
        });
    }
});

module.exports = router;
