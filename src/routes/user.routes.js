import { Router } from "express";
import { loginUser, logoutUser, refreshAccessToken, resgisterUser } from "../controllers/user.controller.js";
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

export default userRouter