import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Comment } from "../models/comment.model.js";

const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const aggregate = Comment.aggregate([
        { $match: { video: new mongoose.Types.ObjectId(videoId) } },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
            },
        },
        { $unwind: "$owner" },
        {
            $project: {
                content: 1,
                createdAt: 1,
                "owner.username": 1,
                "owner.avatar": 1,
            },
        },
        { $sort: { createdAt: -1 } }
    ]);

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
    };

    const result = await Comment.aggregatePaginate(aggregate, options);

    return res.status(200).json(
        new ApiResponse(200, result, "Comments fetched successfully")
    );
});

const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }
    const { content } = req.body;
    const newComment = new Comment({
        content: content,
        video: videoId,
        owner: req.user._id
    });
    await newComment.save();
    return res.status(201).json(new ApiResponse(201, newComment, "Comment added successfully"));
}
);

const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }
    const { content } = req.body;
    const comment = await Comment.findByIdAndUpdate(commentId, { content: content }, { new: true });
    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }
    return res.status(200).json(new ApiResponse(200, comment, "Comment updated successfully"));
}
);

const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }
    const comment = await Comment.findByIdAndDelete(commentId);
    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }
    return res.status(200).json(new ApiResponse(200, null, "Comment deleted successfully"));
}
);
export { getVideoComments, addComment, deleteComment, updateComment };