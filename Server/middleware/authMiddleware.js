const jwt = require('jsonwebtoken');
const Users = require('../models/users');
const redisClient = require('../utility/redisClient');

const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Authorization token required' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        // Check Redis blacklist
        let isBlacklisted = false;
        try {
            if (redisClient.isOpen) {
                isBlacklisted = await redisClient.get(`blacklist:${token}`);
            } else {
                console.warn('Redis client is not connected. Skipping blacklist check.');
            }
        } catch (redisError) {
            console.error('Redis blacklist check failed:', redisError);
        }

        if (isBlacklisted) {
            return res.status(401).json({ success: false, message: 'Token is invalid' });
        }

        const user = await Users.findById(decoded.id).select('-userPassword');
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found, authorization denied' });
        }

        req.user = user;
        req.token = token;
        req.tokenExp = decoded.exp;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
};

module.exports = authMiddleware;
