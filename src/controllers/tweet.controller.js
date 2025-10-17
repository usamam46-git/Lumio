import mongoose from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
    const { content } = req.body;

    if (!content) {
        throw new ApiError(400, "Content is required");
    }

    const tweet = await Tweet.create({
        content: content,
        user: req.user._id,
    });

    res.status(201).json(new ApiResponse(201, tweet, "Tweet created successfully"));
});

const getUserTweets = asyncHandler(async (req,res) => {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const tweets = await Tweet.find({ user: userId });

    res.status(200).json(new ApiResponse(200, tweets, "User tweets retrieved successfully"));
});

const updateTweet = asyncHandler(async (req,res) => {
    const { tweetId } = req.params;
    const { content } = req.body;

    if (!content) {
        throw new ApiError(400, "Content is required");
    }

    const tweet = await Tweet.findByIdAndUpdate(tweetId, { content }, { new: true });

    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    res.status(200).json(new ApiResponse(200, tweet, "Tweet updated successfully"));
});

const deleteTweet = asyncHandler(async (req,res) => {
    const { tweetId } = req.params;
    const tweet = await Tweet.findByIdAndDelete(tweetId);

    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }
    res.status(200).json(new ApiResponse(200, null, "Tweet deleted successfully"));
});

const getAllTweets = asyncHandler(async (req, res) => {
    const tweets = await Tweet.find().populate("owner", "username email").sort({ createdAt: -1 });
    if(!tweets || tweets.length === 0){
        throw new ApiError(404, "No tweets found");
    }
    res.status(200).json(new ApiResponse(200, tweets, "All tweets retrieved successfully"));
});


export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet,
    getAllTweets
};
