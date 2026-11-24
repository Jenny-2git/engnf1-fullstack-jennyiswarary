
const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
    // Read the Authorization header
    const authHeader = req.headers.authorization;

    // Check whether the token exists
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            error: {
                code: "UNAUTHENTICATED",
                message: "Authentication token is required"
            }
        });
    }

    // Extract the token
    const token = authHeader.split(" ")[1];

    try {
        // Verify the token using our secret key
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach the logged-in user's information to the request
        req.user = decoded;

        // Continue to the next middleware or route
        next();

    } catch (error) {
        return res.status(401).json({
            error: {
                code: "UNAUTHENTICATED",
                message: "Invalid or expired token"
            }
        });
    }
}

module.exports = authenticateToken;
