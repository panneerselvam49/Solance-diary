const Entries = require('../models/entries');

// Create a new entry
exports.createEntry = async (req, res) => {
    try {
        const { title, notes, mood } = req.body;

        if (!notes) {
            return res.status(400).json({ success: false, message: "Notes content is required" });
        }

        const newEntry = new Entries({
            userId: req.user._id,
            title,
            notes,
            mood
        });

        await newEntry.save();

        return res.status(201).json({
            success: true,
            message: "Entry created successfully",
            data: newEntry
        });
    } catch (error) {
        console.error("Create entry error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

// Get all entries for the logged-in user
exports.getEntries = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const entries = await Entries.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalEntries = await Entries.countDocuments({
            userId: req.user._id
        })

        return res.status(200).json({
            success: true,
            page,
            limit,
            totalEntries,
            totalPages: Math.ceil(totalEntries / limit),
            data: entries
        });
    } catch (error) {
        console.error("Get entries error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

// Get single entry by ID
exports.getEntryById = async (req, res) => {
    try {
        const entry = await Entries.findOne({ _id: req.params.id, userId: req.user._id });

        if (!entry) {
            return res.status(404).json({ success: false, message: "Entry not found" });
        }

        return res.status(200).json({
            success: true,
            data: entry
        });
    } catch (error) {
        console.error("Get entry by ID error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

// Update an entry
exports.updateEntry = async (req, res) => {
    try {
        const { title, notes, mood } = req.body;

        const entry = await Entries.findOne({ _id: req.params.id, userId: req.user._id });

        if (!entry) {
            return res.status(404).json({ success: false, message: "Entry not found" });
        }

        if (title !== undefined) entry.title = title;
        if (notes !== undefined) entry.notes = notes;
        if (mood !== undefined) entry.mood = mood;

        await entry.save();

        return res.status(200).json({
            success: true,
            message: "Entry updated successfully",
            data: entry
        });
    } catch (error) {
        console.error("Update entry error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

// Delete an entry
exports.deleteEntry = async (req, res) => {
    try {
        const entry = await Entries.findOneAndDelete({ _id: req.params.id, userId: req.user._id });

        if (!entry) {
            return res.status(404).json({ success: false, message: "Entry not found" });
        }

        return res.status(200).json({
            success: true,
            message: "Entry deleted successfully",
        });
    } catch (error) {
        console.error("Delete entry error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};
