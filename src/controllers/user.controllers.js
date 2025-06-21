import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudniary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  const { fullName, username, email, password } = req.body;
  //validations
  if (
    [].some((field) => {
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

  const avatarLocalPath = req.files?.avatar[0].path;
  const coverLocalPath = req.files?.coverImage[0].path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudniary(avatarLocalPath);
  let coverImage = "";
  if (coverLocalPath) {
    coverImage = await uploadOnCloudniary(coverLocalPath);
  }

  const user = await User.create({
    fullName,
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
});

export { registerUser };
