const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
    {
        userName: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        userEmail: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        userPassword: {
            type: String,
            required: true,
            minlength: 6,
        },
    },
    {
        timestamps: true
    }
);

userSchema.pre('save', async function () {
    if (!this.isModified('userPassword')) return;

    this.userPassword = await bcrypt.hash(this.userPassword, 10);
});

userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.userPassword);
}

module.exports = mongoose.model("Users", userSchema);