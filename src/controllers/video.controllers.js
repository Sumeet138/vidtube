import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  //TODO: get all videos based on query, sort, pagination
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  if (
    [title, description].some((field) => {
      field.trim() === "";
    })
  ) {
    throw new ApiError(400, "All fields are required");
  }
  // TODO: get video, upload to cloudinary, create video
  const videoFileLocalPath = req.files?.videoFile?.[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

  if (!videoFileLocalPath) {
    throw new ApiError(400, "Video file is required");
  }

  if (!thumbnailLocalPath) {
    throw new ApiError(400, "Thumbnail is required");
  }

  let videoFile;
  try {
    videoFile = await uploadOnCloudinary(videoFileLocalPath);
    if (!videoFile) {
      throw new ApiError(500, "Failed to upload video file");
    }
    console.log("Video file uploaded to cloudinary", videoFile.url);
  } catch (error) {
    throw new ApiError(500, "Error uploading video file to cloudinary");
  }

  let thumbnail;
  try {
    thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    if (!thumbnail) {
      throw new ApiError(500, "Failed to upload thumbnail");
    }
    console.log("Thumbnail uploaded to cloudinary", thumbnail.url);
  } catch (error) {
    console.log();
    throw new ApiError(500, "Error uploading thumbnail to cloudinary");
  }
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
