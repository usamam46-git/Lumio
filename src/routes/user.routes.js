import { Router } from "express";
import { changeCurrentPassword, getCurrentUser, getUserChannelProfile, getWatchHistory, loginUser, logoutUser, refreshAccessToken, resgisterUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const userRouter = Router()
userRouter.route("/register").post(upload.fields([
    {
        name: "avatar",
        maxCount: 1
    },{
        name: "coverImage",
        maxCount: 1
    }
]),resgisterUser)

userRouter.route("/login").post(loginUser)

//secured routes
//Here this verifyJWT is actually coming from the auth middleware that we made. We can make and add as many middlewares as we want and those will eventually add some functionality in the middle.
userRouter.route("/logout").post(verifyJWT, logoutUser)
//Now our logic don't really need this verifyJWT in below route because we have already done that inside user.controller.js
userRouter.route("/refresh-token").post(refreshAccessToken)
userRouter.route("/change-password").post(verifyJWT, changeCurrentPassword)
//Down here we are using get method because we are just getting user and not posting anything.
userRouter.route("/current-user").get(verifyJWT, getCurrentUser)
userRouter.route("/update-account").patch(verifyJWT, updateAccountDetails)

userRouter.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar)

userRouter.route("/cover-image").patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage)

//Using this route down here because we are getting data through params in getUserChannleProfile

userRouter.route("/c/:username").get(verifyJWT,getUserChannelProfile)

userRouter.route("/history").get(verifyJWT, getWatchHistory)


export default userRouter