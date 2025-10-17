import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Like from "../models/like.model.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }
    const userId = req.user.id;

    const existingLike = await Like.findOne({ user: userId, video: videoId });
    if (existingLike) {
        await Like.deleteOne({ user: userId, video: videoId });
        return new ApiResponse(200, {}, "Video unliked");
    }

    await Like.create({ user: userId, video: videoId });
    return new ApiResponse(201, {}, "Video liked");
}
);

const toggleTweetLike = asyncHandler(async (req,res) => {
  const { tweetId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(tweetId)) {
      throw new ApiError(400, "Invalid tweet ID");
  }
  const userId = req.user.id;

  const existingLike = await Like.findOne({ user: userId, tweet: tweetId });
  if (existingLike) {
      await Like.deleteOne({ user: userId, tweet: tweetId });
      return new ApiResponse(200, {}, "Tweet unliked");
  }

  await Like.create({ user: userId, tweet: tweetId });
  return new ApiResponse(201, {}, "Tweet liked");
}
);

const toggleCommentLike = asyncHandler(async (req,res) => {
  const { commentId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
      throw new ApiError(400, "Invalid comment ID");
  }
  const userId = req.user.id;

  const existingLike = await Like.findOne({ user: userId, comment: commentId });
  if (existingLike) {
      await Like.deleteOne({ user: userId, comment: commentId });
      return new ApiResponse(200, {}, "Comment unliked");
  }

  await Like.create({ user: userId, comment: commentId });
  return new ApiResponse(201, {}, "Comment liked");
}
);

const getLikedVideos = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 10 } = req.query;

  const aggregate = Like.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId), video: { $ne: null } } },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
      },
    },
    { $unwind: "$video" },
    { $project: { _id: 1, video: 1 } },
  ]);

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    customLabels: {
      totalDocs: "totalVideos",
      docs: "videos",
    },
  };

  const result = await Like.aggregatePaginate(aggregate, options);

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Liked videos retrieved successfully"));
});


export {
    toggleVideoLike,
    toggleCommentLike,
    getLikedVideos,
    toggleTweetLike
}