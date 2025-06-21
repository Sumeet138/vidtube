import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import {
  uploadOnCloudniary,
  deleteFromCouldinary,
} from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  const { fullname, username, email, password } = req.body;
  //validations
  if (
    [fullname, username, email, password].some((field) => {
      field?.trim() === "";
    })
  ) {
    throw new ApiError(400, "All fields are required");
  }

  //checking if user exist
  const existedUser = await User.findOne({
    $or: [
      {
        username,
      },
      {
        email,
      },
    ],
  });
  if (existedUser) {
    throw new ApiError(409, "User with email or username Already Exists");
  }

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  //   const avatar = await uploadOnCloudniary(avatarLocalPath);
  //   let coverImage = "";
  //   if (coverLocalPath) {
  //     coverImage = await uploadOnCloudniary(coverLocalPath);
  //   }

  let avatar;
  try {
    avatar = await uploadOnCloudniary(avatarLocalPath);
    console.log("Avatar uploaded successfully", avatar);
  } catch (error) {
    console.log("error while uploading avatar", error);
    throw new ApiError(500, "Failed to upload avatar");
  }
  let coverImage;
  try {
    coverImage = await uploadOnCloudniary(coverLocalPath);
    console.log("coverImage uploaded successfully", coverImage);
  } catch (error) {
    console.log("error while uploading coverImage", error);
    throw new ApiError(500, "Failed to upload coverImage");
  }

  try {
    const user = await User.create({
      fullname,
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
      email,
      password,
      username: username.toLowerCase(),
    });

    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );
    if (!createdUser) {
      throw new ApiError(500, "Something was wrong while registering user");
    }

    return res
      .status(201)
      .json(new ApiResponse(200, createdUser, "User register Successfully"));
  } catch (error) {
    console.log("User creation Failed");
    if (avatar) {
      await deleteFromCouldinary(avatar.public_id);
    }
    if (coverImage) {
      await deleteFromCouldinary(coverImage.public_id);
    }
    throw new ApiError(
      500,
      "Something was wrong while registering user and images where deleted"
    );
  }
});

export { registerUser };
