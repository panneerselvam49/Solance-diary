const jwt = require('jsonwebtoken');
const Users = require('../models/users');

const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Authorization token required' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await Users.findById(decoded.id).select('-userPassword');
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found, authorization denied' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
};

module.exports = authMiddleware;
