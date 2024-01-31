import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import { User } from '../models/user.model.js'
import { 
    uploadOnCloudinary,
    deleteFromCloudinary
} from '../utils/cloudinary.js'
import  jwt  from 'jsonwebtoken'
import { sendMail } from '../utils/mail.js'


const generateAccessAndRefereshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {refreshToken,accessToken}

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}

const registerUser  = asyncHandler(async (req,res) => {

    const {fullname, email, username, password } = req.body
    //console.log("email: ", email);

    if (
        [fullname, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }
    console.log(req.files);

    let avatarLocalPath;
    if (req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0) {
        avatarLocalPath = req.files.avatar[0].path
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    console.log("avatarLocalPath",avatarLocalPath);

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    console.log("avatar",avatar?.url);


    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }
    
    const user = await User.create({
        fullname,
        avatar:{
        url: avatar.url,
        public_id: avatar.public_id
        },
        email,
        password,
        username: username.toLowerCase(),
    
    })

    user.markModified('avatar');

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    console.log("createdUser",createdUser);
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(
            200,
            createdUser,
            "User registered Successfully"
            )
    )
})

const loginUser = asyncHandler(async(req,res) => {

    const {username,email,password} = req.body

    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }

    const user = await User.findOne({
        $or: [{username},{email}]
    })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password)

    if (!isPasswordCorrect) {
        throw new ApiError(401, "Invalid user credentials")
    }
    const {accessToken,refreshToken} = await generateAccessAndRefereshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )
})

const logoutUser = asyncHandler(async(req,res) => {
    User.findByIdAndUpdate(
    req.user._id,
    {
        $unset: {
            refreshToken: 1 // this removes the field from document
        }
    },
    {
        new: true
    }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(
        new ApiResponse(
            200,
            {},
            "User is logged Out"
        )
        )
})

const refreshAccessToken = asyncHandler(async(req,res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if (decodedToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken,newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
            )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async(req,res) => {

    const {newPassword,oldPassword} = req.body

    const user = await User.findById(req.user._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    
    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {},
            "Password changed successfully"
            )
        )  

})

const getCurrentUser = asyncHandler(async(req,res) => {
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            req.user,
            "User fetched successfully"
            )
        )
})

const updateAccountDetails = asyncHandler(async(req,res) => {

    const {fullname,email} = req.body

    if (!fullname || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                fullname,
                email
            }
        },
        {
            new : true
        }
        ).select("-password -refreshToken")

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "Account details updated successfully"
            )
        )

})

const updateUserAvatar = asyncHandler(async(req,res) => {

    const avatarLocalPath = req.file?.path;

try {
    if (!avatarLocalPath) {
        throw new ApiError("Avatar local path is missing");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar || !avatar.url || !avatar.public_id) {
        throw new ApiError("Avatar upload failed or missing data");
    }

    //update new avatar
    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                avatar: {
                    url: avatar.url,
                    public_id: avatar.public_id,
                },
            },
        },
        {
            new: true,
        }
    ).select("-password -refreshToken")    
    
    if (!user || !user.avatar || !user.avatar.public_id) {
        throw new ApiError("Missing public_id for avatar in user object");
    }

    console.log("public_id", user.avatar.public_id);
    
    // Delete the old avatar from Cloudinary
    const deleteOldAvatar = await deleteFromCloudinary(user.avatar.public_id);
    
    if (!deleteOldAvatar) {
        throw new ApiError("Error deleting old avatar");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "Cover image updated successfully"
            )
    )
} catch (error) {
    throw new ApiError(500,error?.message || "Internal Server Error")
}
})

const forgetPassword = asyncHandler(async(req,res) => {

    const {email} = req.body;

    const user = await User.findOne({ email })

    if (!user) {
        throw new ApiError(400,"User does not exists")
    }

    const { forgetToken, hashedToken, tokenExpiry} = user.forgotPasswordToken()

    user.forgotPasswordToken = hashedToken;
    user.forgotPasswordExpiry = tokenExpiry;
    await user.save({ validateBeforeSave: false });

    await sendMail({
        email: username.email,
        subject: "Password reset request",
        mailgenContent: forgotPasswordMailgenContent(
            user.username,
            `${req.protocol}://${req.get(
        "host"
        )}/api/v1/users/reset-password/${forgetToken}`
        )
    })
    return res
    .status(200)
    .json(
    new ApiResponse(
        200,
        {},
        "Password reset mail has been sent on your mail id"
    )
    );
})

const passwordReset = asyncHandler(async(req,res) => {

    const {resetToken} = req.params;
    const {newPassword} = req.body;

    let hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

    const user = await User.findOne({
        forgotPasswordToken: hashedToken,
        forgotPasswordExpiry: { $gt: Date.now()}
    })

    if (!user) {
        throw new ApiError(489, "Token is invalid or expired");
    }

    user.forgotPasswordToken = undefined;
    user.forgotPasswordExpiry = undefined;

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {},
            "Password reset successfully"
            )
        );

})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    forgetPassword,
    passwordReset
}