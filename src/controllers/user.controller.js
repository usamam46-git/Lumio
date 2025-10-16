import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

//This whole async function we are creating here is to be used in login functionality for making steps easy and clean to get access and refresh tokens.
const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        //This user.refreshToken is actually coming from our model schema that we made. Because we are using the whole user object here.
        user.refreshToken = refreshToken
        //This validateBeforeSave false is ensuring that it doesn't interfere with password everytime token is refreshed.
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }


    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access tokens")
    }
}

// We are using async here because there are som actions here that will surely take time.
const resgisterUser = asyncHandler(async (req, res) => {
    //***Following are the logic building steps. Noted these down for my own ease. */
    // get user details from frontend(postman)
    // validation-not empty
    // check if user already exists: username, email 
    // check for images, check for avatar
    // upload them to cloudinary, avatar (also a check for if avatar uploaded or even multer uploaded that or not)
    // create user object - create entry in DB
    // remove password and refresh token field from response
    // check for user creation
    // return response

    const { fullName, email, username, password } = req.body
    // console.log("email: ", email);
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }
    //This User written down there is coming from User model.js. By using findOne and $or we are checking in database if username or email already exists
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists.")
    }
    // console.log(req.files)
    //This step is the checkpoint using multer checking for image files. We provide multer the path public and original name. Now we are checking through it.
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    //This above way would've worked too. But since we are doing conditional chaining and we are not having any check on coverImage like we are doing on avatar. We need to use classic JavaScript.
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required.")
    }
    //This uploadOnCloudinary method is coming from our utility class cloudinary.js from utils folder
    //And we are using await here because file uploads will surely take time.
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required.")
    }
    // Await is good to use here too
    const user = await User.create({
        fullName,
        //We are only using .url here because in database we will only be saving the url.
        avatar: avatar.url,
        //Below we are checking if the coverImage actually exists because if the user didn't provide the coverImage path and we hadn't use the if condition here then the code would have surely caused problems.
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })
    //This below is an optional call to database but we are doing this to confirm if our feature was actually served or not and this findbyId is a method provided by mongoDB.
    //This .select is weird syntax but we pass those fields inside it that we don't want to get revealed. We do that by adding a negative sign before it. Negative sign is used because by default all are selected and negative sign will actually show what we don't want.
    const createdUser = await User.findById(user._id).select("-password -refreshToken")
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user.")
    }
    return res.status(201).json(
        //This ApiResponse is from ApiResponse utility class we made earlier and this made our response process quite easy.
        new ApiResponse(200, createdUser, "User registered successfully.")
    )
})

const loginUser = asyncHandler(async (req, res) => {
    // req.body -> data
    //check username and email
    //check if registered user exists in database
    // password check
    // Access and refresh tokens.
    // send cookies

    const { email, username, password } = req.body
    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }
    //This $or is what we are actually doing to build our logic for both cases username and email. Simple logic for either one would have also be written but this is for learning purpose.
    //And this $or is a method from MongoDB. There are many others too. We can check those throuh suggestions.
    const user = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (!user) {
        throw new ApiError(404, "User does not exists.")
    }
    //This logic is to check password. Important thing here is that we used user not User. Because User is coming from mongoDB and isPasswordCorrect isn't a method of MongoDB. We are checking through bcrypt on our own made user.
    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid) {
        throw new ApiError(404, "Password isn't correct.")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    //Designing Cookies
    const options = {
        //This httpOnly means this field is only customizable from server side, not from frontend or anywhere.
        httpOnly: true,
        secure: true
    }
    //These cookies below is coming from cookie-parser that we installed earlier.
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    //This user field below is actually data that we declared in our ApiResponse class like this.data = data
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged in successfully."
            )
        )
})

const logoutUser = asyncHandler(async (req, res) => {
    //First step= Remove all cookies.
    //Second Step= Clear refresh tokens.
    User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )
    const options = {
        //This httpOnly means this field is only customizable from server side, not from frontend or anywhere.
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged out"))

}
)

//Important***V16:15 Making this refresh token to implement after logout. Here we are using that same verifyJWT middleware that was custom made and we used earlier in logout
const refreshAccessToken = asyncHandler(async (req, res) => {
    //We used both req down in this line because user can be on phone too.
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request")
    }
    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
        //Now we are getting the user here from MongoDB
        const user = User.findById(decodedToken?._id)
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
        //Now there is a thing to notice here. We got two kind of tokens. First one is decoded(incomingRefreshToken). Second one(encoded one) is coming from the method above with long name just after imports.
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }
        const options = {
            httpOnly: true,
            secure: true
        }
        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id)
        return res.status(200).cookie("accessToken", accessToken, options).cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token refreshed successfully."
                )
            )
    } catch (error) {
        throw new ApiError(401, error?.message || "Failed to refresh token.")
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body
    //We are not verifying access refresh tokens here because we will be doing that in routes by simply using our verifyJWT middleware that we made earlier.
    const user = await User.findById(req.user?._id)
    //This isPasswordCorrect that we are using with await is actually applying method on mongoose user.**** Check out user model for clearance.
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if (!isPasswordCorrect) {
        throw new ApiError(401, "Password is not correct.")
    }
    //Setting up the new password down here.
    user.password = newPassword
    await user.save({ validateBeforeSave: false })
    //Now this password is getting hashed on its own because it is modified. The process of getting hashed is coming from user.model line 51-55
    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"))
}
)
//Lets say if we want to add a confirm password field above we will just compare newPassword with the confirmPassword like this this if(!(newPassword === confirmPassword)){and throw new error here....}

//This below method became quite simple because we had already done that user part and got that.
const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(200, req.user, "Current user fetched successfully.")
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body
    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required.")
    }
    const user = await User.findByIdAndUpdate(req.user?._id, {
        $set: {
            fullName: fullName,
            email: email
        }
    }, { new: true }).select("-password")
    //By using select up there we actually saved an unneccessary API call by simply using select here instead of finding user again by id and repeating the process.
    if (!user) {
        throw new ApiError(400, "Couldn't update account details.")
    }
    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account details updated successfully."))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    //This req.file below is coming from multer middleware. One important thing here is that we are using file here not files. Because earlier we used files in order to save an array.
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing.")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar.")
    }
    const user = await User.findByIdAndUpdate(req.user?._id, {
        $set: {
            avatar: avatar.url
        }
    }, { new: true }).select("-password")
    return res
        .status(200)
        .json(new ApiResponse(200, user, "Avatar image updated successfully."))

})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    //This req.file below is coming from multer middleware. One important thing here is that we are using file here not files. Because earlier we used files in order to save an array.
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover Image file is missing.")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on avatar.")
    }
    const user = await User.findByIdAndUpdate(req.user?._id, {
        $set: {
            coverImage: coverImage.url
        }
    }, { new: true }).select("-password")
    return res
        .status(200)
        .json(new ApiResponse(200, user, "Avatar image updated successfully."))

})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params
    if (!username?.trim()) {
        throw new ApiError(400, "username is missing")
    }
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                //This subscriptions down here is actually Subscription coming from subscription model. We wrote it as subscriptions because we studied earlier that mongoDB converts it into plural and lowercase.
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
                //Here we are done with our first pipeline, where we found subscribers.
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
                //Here is the second pipeline where we are finding what a user has subscribed to.
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscibedToCount: {
                    $size: "$subscribedTo"
                    //Here we are basically adding these fields inside user model though aggregation pipeline.
                },
                isSubscribed: {
                    //This is the if, then, else through mongoDB based on condition.
                    //This $in can be used both for arrays and objects too.
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subsciber"] },
                        then: true,
                        else: false
                    }
                }
            }
        }, {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscibedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])
    //First we should console the channel to find what kind of data we are getting.
    if(!channel?.length){
        throw new ApiError(404, "channel does not exists.")
    }
    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully.")
    )
})

const getWatchHistory = asyncHandler(async (req,res) => {
  const user = await User.aggregate([
    {
        $match: {
            _id: new mongoose.Types.ObjectId(req.user._id)
        }
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField:"_id",
                    as:"owner",
                    //This down here is a sub pipeline because it will just be here to populate the owner field only.
                    pipeline: [
                        {
                            $project: {
                                fullName: 1,
                                username: 1,
                                avatar: 1
                            }
                        }
                    ]
                }
            },
            //This further data structure is only for ease of frontend because above process will just give an array and there will be need to loop through it. Now in further addFields we will make it easy for the frontend.
            {
                $addFields:{
                    //Here we are only showing that field which is needed and that is owner.
                    owner:{
                        $first: "$owner"
                    }
                }
            }
        ]
      }
    }
  ])

  return res
  .status(200)
  .json(
    new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully."
    )
  )
}
)


export { resgisterUser, loginUser, logoutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, getUserChannelProfile, getWatchHistory }