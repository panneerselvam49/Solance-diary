const express = require('express');
const router = express.Router();
const authController = require('../Auth/auth');
const entriesController = require('../controllers/entriesController');
const authMiddleware = require('../middleware/authMiddleware');

// Auth Routes
router.post('/auth/register', authController.createUsers);
router.post('/auth/login', authController.loginUser);
router.post('/auth/updatePassword', authController.updatePassword);
router.post('/auth/sendOTP', authController.sendOTP);
router.post('/auth/verifyOTP', authController.verifyOTP);
router.post('/auth/resetPassword', authController.resetPassword);

// Entries Routes (Protected)
router.post('/entries', authMiddleware, entriesController.createEntry);
router.get('/entries', authMiddleware, entriesController.getEntries);
router.get('/entries/:id', authMiddleware, entriesController.getEntryById);
router.put('/entries/:id', authMiddleware, entriesController.updateEntry);
router.delete('/entries/:id', authMiddleware, entriesController.deleteEntry);

module.exports = router;
