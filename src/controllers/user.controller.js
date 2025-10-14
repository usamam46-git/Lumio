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
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if (incomingRefreshToken) {
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

export { resgisterUser, loginUser, logoutUser,refreshAccessToken }