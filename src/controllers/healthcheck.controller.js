import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const healthcheck = asyncHandler(async (req, res) => {
  return new ApiResponse(res.status(200).json({ status: "OK", message: "Healthcheck passed" }))
})

export {
    healthcheck
    }