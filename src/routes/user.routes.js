import { Router } from "express";
import { resgisterUser } from "../controllers/user.controller.js";

const userRouter = Router()

userRouter.route("/register").post(resgisterUser)

export default userRouter