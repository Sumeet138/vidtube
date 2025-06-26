import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import {
  uploadOnCloudniary,
  deleteFromCouldinary,
} from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessTokenAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    //generating tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    //saving
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong, while generating access token and refresh token"
    );
  }
};

const loginUser = asyncHandler(async (req, res) => {
  //get data from body
  const { email, username, password } = req.body;

  //validations
  if (
    [email, username, password].some((field) => {
      field?.trim() === "";
    })
  ) {
    throw new ApiError(400, "All fields are required");
  }
  const user = await User.findOne({
    $or: [
      {
        username,
      },
      {
        email,
      },
    ],
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  //validate password
  const isPasswordCorrect = await user.isPasswordCorrect(password);
  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invalid Password");
  }

  //generate tokens
  const { accessToken, refreshToken } =
    await generateAccessTokenAndRefreshToken(user._id);

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  if (!loggedInUser) {
    throw new ApiError(500, "Something was wrong while logging in user");
  }

  //set cookies
  const option = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, option)
    .cookie("refreshToken", refreshToken, option)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    $set: {
      refreshToken: undefined,
    },
  });

  option = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };
  return res
    .status(200)
    .clearCookie("accessToken", option)
    .clearCookie("refreshToken", option)
    .json(new ApiResponse(200, "User logged out Successfully"));
});

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

  //getting images path from multer
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  /*
     const avatar = await uploadOnCloudniary(avatarLocalPath);
     let coverImage = "";
     if (coverLocalPath) {
       coverImage = await uploadOnCloudniary(coverLocalPath);
     }

  */
  //Uploading images on cloudinary
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
  // Creating user
  try {
    const user = await User.create({
      fullname,
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
      email,
      password,
      username: username.toLowerCase(),
    });
    //checking if user is created
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

const refreshAccesToken = asyncHandler(async (req, res) => {
  //getting refresh token
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token is missing");
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRECT
    );
    const user = await User.findById(decodedToken._id);
    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Invalid refresh token");
    }
    const option = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };
    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessTokenAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, option)
      .cookie("refreshToken", newRefreshToken, option)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed Successfully"
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while refreshing access token"
    );
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);

  const isPasswordValid = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordValid) {
    throw new ApiError(401, "Old Password is incorrect");
  }
  //already encrypted in user model middleware in which save is return
  user.password = newPassword;
  user.save({ validateBeforeSave: false });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password was changed successfully"));
});
const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current User details"));
});
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;
  if (!fullname || !email) {
    throw new ApiError(400, "fullname and email are required");
  }
  const user = await User.findByIdAndUpdate(req.user?._id, 
    $set: {
      fullname,
      email,
    },
    { new: true},
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});
const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath =req.files?.path
  if (!avatarLocalPath){
    throw new ApiError(400, "Avatar is required");
  }
  const avatar = await uploadOnCloudniary(avatarLocalPath)
  if (!avatar.url){
    throw new ApiError(500, "Failed to upload avatar");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    }, { new: true }
  ).select("-password -refreshToken");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully"));
});
const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath =req.files?.path
  if (!coverImageLocalPath){
    throw new ApiError(400, "Cover image is required");
  }
  const coverImage = await uploadOnCloudniary(coverImageLocalPath)
  if (!coverImage.url){
    throw new ApiError(500, "Failed to upload cover image");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    }, { new: true }
  ).select("-password -refreshToken");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"));
});

export { 
  registerUser,
  loginUser,
  refreshAccesToken,
  logoutUser,
  changeCurrentPassword,
  getCurrentUser, 
  updateAccountDetails, 
  updateUserAvatar, 
  updateUserCoverImage 
};
