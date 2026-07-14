const mongoose = require('mongoose')

const entrySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Users',
            required: true
        },

        title: {
            type: String,
            trim: true,
        },

        notes: {
            type: String,
            required: true,
        },

        mood: {
            type: String,
        },

        location: {
            type: String,
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('entries', entrySchema);