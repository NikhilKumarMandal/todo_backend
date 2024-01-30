import mongoose, {Schema} from "mongoose";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt";
import crypto from "crypto";

const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true, 
            index: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowecase: true,
            trim: true, 
        },
        fullname: {
            type: String,
            required: true,
            trim: true, 
        },
        avatar: {
            public_id: {
                type: String,
            },
            url: {
                type: String,
                required: true
            }
        },
        password: {
            type: String,
            required: [true, 'Password is required']
        },
        forgotPasswordToken: {
            type: String,
        },
        forgotPasswordExpiry: {
            type: Date,
        },
        refreshToken: {
            type: String
        },
    },
    {
        timestamps: true
    }
)

userSchema.pre("save", async function (next) {
    if(!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 10)
    next()
})

userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password, this.password)
}

userSchema.methods.generateAccessToken = function(){
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullname: this.fullname
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}
userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id: this._id,
            
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.forgetPasswordToken = function(){

    const forgetToken = crypto.randomBytes(20).toString('hex');

    const hashedToken = crypto
    .createHash("sha256")
    .update(forgetToken)
    .digest("hex");

    const tokenExpiry = Date.now() + process.env.FORGET_PASSWORD_TOKEN_EXPIRY

    return {
        forgetToken,
        hashedToken,
        tokenExpiry
        }
}

export const User = mongoose.model("User", userSchema)