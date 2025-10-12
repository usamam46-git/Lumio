import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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
    console.log("email: ", email);
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }
    //This User written down there is coming from User model.js. By using findOne and $or we are checking in database if username or email already exists
    const existedUser = User.findOne({
        $or: [{ username }, { email }]
    })
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists.")
    }
    //This step is the checkpoint using multer checking for image files. We provide multer the path public and original name. Now we are checking through it.
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

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

export { resgisterUser }