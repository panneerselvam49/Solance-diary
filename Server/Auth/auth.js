const jwt = require('jsonwebtoken');
const Users = require('../models/users');
const crypto = require('crypto');
const mailer = require('../utility/mailer');
const { createClient } = require('redis');

const client = createClient();

client.on('error', err => console.log('Redis Client Error', err));

client.connect().then(() => {
    console.log("Redis connected!");
})
.catch(err => {
    console.log("Error connecting to redid", err);
});

const JWT_SECRET = process.env.JWT_SECRET;

// Register User
exports.createUsers = async (req, res) => {
    try {
        const { userName, userEmail, userPassword } = req.body;

        if (!userName || !userEmail || !userPassword) {
            return res.status(400).json({ success: false, message: "Please provide userName, userEmail, and userPassword" });
        }

        // Check if user already exists
        const userExists = await Users.findOne({
            $or: [{ userEmail: userEmail.toLowerCase() }, { userName: userName.toLowerCase() }]
        });

        if (userExists) {
            return res.status(400).json({ success: false, message: "Username or Email already exists" });
        }

        // Create new user
        const newUser = new Users({
            userName,
            userEmail,
            userPassword
        });

        await newUser.save();

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
        });
    } catch (error) {
        console.error("Register error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

// Login User
exports.loginUser = async (req, res) => {
    try {
        const { userEmail, userPassword } = req.body;

        if (!userEmail || !userPassword) {
            return res.status(400).json({ success: false, message: "Please provide userEmail and userPassword" });
        }

        // Find user by email
        const user = await Users.findOne({ userEmail: userEmail.toLowerCase() });
        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid email or password" });
        }

        // Check password
        const isMatch = await user.comparePassword(userPassword);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        // Generate JWT Token
        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });

        return res.status(200).json({
            success: true,
            message: "Logged in successfully",
            token,
            user: {
                userName: user.userName,
                userMail: user.userEmail
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

exports.updatePassword = async (req, res) => {
    try {
        const { newPassword, existingPassword } = req.body;

        if (!newPassword || !existingPassword) {
            return res.send({ success: false, message: "Please enter old and new password" });
        }

        const user = await Users.findOne({ userEmail: req.body.email });

        if (!user) {
            return res.send({ sucess: false, message: "User not found" });
        }

        const isMatch = await user.comparePassword(existingPassword);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Current password is incorrect" });
        }

        const isSamePaswword = await user.comparePassword(newPassword);

        if (isSamePaswword) {
            return res.status(401).json({ success: false, message: "Current password and new password are same" });
        }

        user.userPassword = newPassword

        await user.save();

        return res.status(200).json({ success: true, message: "Password updated" });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

exports.sendOTP = async (req, res) => {
    try {
        const {userEmail} = req.body;

        if (!userEmail) {
            return res.status(400).json({ success: false, message: "Please provide userEmail" });
        }

        const user = await Users.findOne({ userEmail: userEmail.toLowerCase() });
        if (!user) {
            return res.status(400).json({ success: false, message: "User not found" });
        }
        
        const OTP = crypto.randomInt(100000, 10000000);

        // Store OTP in Redis
        await client.set(`otp:${userEmail}`, OTP);

        // Automatically delete OTP after 3 minutes
        await client.expire(`otp:${userEmail}`, 180);

        await mailer.sendMail({
            from: process.env.EMAIL,
            to: user.userEmail,
            subject: "OTP for password reset",
            text: `Your OTP is ${OTP}. It will expire in 10 minutes.`
        });

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully"
        });

    } catch (error) {
        console.error("Send OTP error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

exports.verifyOTP = async (req, res) => {
    try {
        const {userEmail, OTP} = req.body;

        if (!userEmail || !OTP) {
            return res.status(400).json({ success: false, message: "Please provide userEmail and OTP" });
        }

        const storedOTP = await client.get(`otp:${userEmail}`);
        
        if (!storedOTP) {
            res.status(401).json({ sucess: false, message: "OTP not found or Expired" });
        }

        if (Number(storedOTP) !== Number(OTP)) {
            res.status(400).json({ success: false, message: "Invalid OTP" });
        }

        if (storedOTP && Number(storedOTP) === Number(OTP)) {
            client.del(`otp:${userEmail}`);
        }

        // Generate a reset token valid for 15 minutes
        const resetToken = jwt.sign({ email: userEmail, purpose: 'reset-password' }, JWT_SECRET, { expiresIn: '15m' });

        return res.status(200).json({ success: true, message: "OTP verified successfully", resetToken });
    } catch (error) {
        console.error("Verify OTP error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

exports.resetPassword = async (req, res) => {
    try {
        const { resetToken, newPassword } = req.body;

        if (!resetToken || !newPassword) {
            return res.status(400).json({ success: false, message: "Please provide reset token and new password" });
        }

        // Verify the reset token
        let decoded;
        try {
            decoded = jwt.verify(resetToken, JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ success: false, message: "Invalid or expired reset token" });
        }

        if (decoded.purpose !== 'reset-password') {
            return res.status(400).json({ success: false, message: "Invalid token purpose" });
        }

        const user = await Users.findOne({ userEmail: decoded.email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const isSamePaswword = await user.comparePassword(newPassword);

        if (isSamePaswword) {
            return res.send({ success: false, message: "Current password and New Password are same" });
        }

        user.userPassword = newPassword;
        await user.save();

        return res.status(200).json({ success: true, message: "Password reset successfully" });
    } catch (error) {
        console.error("Reset password error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}
