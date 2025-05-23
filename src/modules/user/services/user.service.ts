import { Model, ObjectId } from 'mongoose';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '@/db/schemas/users/user.schema';
import { UserDto } from '../dto/user.request.dto';
import * as bcrypt from 'bcrypt';
import { auth } from 'googleapis/build/src/apis/oauth2';
import { responseGenerator } from '@/common/config/helper/response.helper';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
  ) {}

  async create(userData: UserDto) {
    const { email, password } = userData;

    const isUserAlreadyExist = await this.userModel.findOne({ email });
    if (isUserAlreadyExist)
      throw new HttpException(
        'User already exist with this email',
        HttpStatus.BAD_REQUEST,
      );

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new this.userModel({
      ...userData,
      password: hashedPassword,
    });
    return user.save();
  }

  async getUserById(id: string) {
    const user = await this.userModel.findById(id).lean();

    if (!user) return null;
    return user;
  }

  async getUserByIdRouteHandler(id: string) {
    const user = await this.userModel
      .findById(id)
      .populate({
        path: 'credit_account_id',
        model: 'CreditAccount',
      })
      .lean();
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    const userObj = user;
    user['credit_account'] = user['credit_account_id'];
    user['id'] = user._id.toString();
    const payload = {
      sub: user._id,
      roles: user.roles,
      access_code: user.access_code,
      google_id: user.google_id,
      name: user.name,
      email: user.email,
      credit_account: user.credit_account_id,
      phone: user.phone,
      is_verified: user.is_verified,
      is_google_authenticated: user.is_google_authenticated,
      is_youtube_authenticated: user.is_youtube_authenticated,
    };
    user['access_token'] = await this.jwtService.signAsync(payload);
    delete user['credit_account_id'];

    return responseGenerator('User found', userObj, true);
  }

  async saveTokens(
    userId: string,
    accessToken: string,
    refreshToken: string,
  ): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: userId },
        {
          google_access_token: accessToken,
          google_refresh_token: refreshToken,
        },
      )
      .exec();
  }

  async refreshAccessToken(userId: string): Promise<string> {
    const user = await this.getUserById(userId);
    const oauth2Client = new auth.OAuth2();
    oauth2Client.setCredentials({
      refresh_token: user.google_refresh_token,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    await this.saveTokens(
      userId,
      credentials.access_token,
      credentials.refresh_token,
    );
    return credentials.access_token;
  }

  async saveVideo(userId: string, videoId: string) {
    await this.userModel.findByIdAndUpdate(
      userId,
      {
        $push: { videos: videoId },
      },
      { new: true },
    );

    return {
      success: true,
    };
  }

  async saveAudio(userId: string, audioId: string) {
    await this.userModel.findByIdAndUpdate(
      userId,
      {
        $push: { audios: audioId },
      },
      { new: true },
    );

    return {
      success: true,
    };
  }

  async getUserByGoogleId(googleId: string) {
    const user = await this.userModel.findOne({ google_id: googleId });

    if (!user) return null;

    return user;
  }

  async getVideosList(userId: string, tl = false) {
    try {
      const user = await this.userModel
        .findById(userId)
        .populate({
          path: 'videos',
          options: {
            sort: { _id: -1 },
          },
        })
        .lean();

      if (!user)
        throw new HttpException(
          'User not exist with this _Id',
          HttpStatus.NOT_FOUND,
        );

      let videos = user.videos;
      // if (tl) {
      //   videos = videos.filter(
      //     (video) =>
      //       video.tl_task_id !== undefined && video.tl_task_id !== null,
      //   );
      // }

      return videos;
    } catch (error) {
      throw new Error(JSON.stringify(error));
    }
  }

  async getAudiosList(userId: string) {
    try {
      const user = await this.userModel
        .findById(userId)
        .populate({
          path: 'audios',
          options: {
            sort: { _id: -1 },
          },
        })
        .lean();

      if (!user)
        throw new HttpException(
          'User not exist with this _Id',
          HttpStatus.NOT_FOUND,
        );

      let audios = user.audios;

      return audios;
    } catch (error) {
      throw new Error(JSON.stringify(error));
    }
  }

  async verifyUserAccessCode(userId: ObjectId, accessCode: number) {
    const user = await this.userModel
      .findById(userId)
      .select('access_code')
      .lean();

    if (user.access_code === accessCode) return true;

    return false;
  }

  async addDubbings(userId: string, dubbingId: ObjectId) {
    await this.userModel.findByIdAndUpdate(userId, {
      $push: { dubbings: dubbingId },
    });

    return true;
  }

  async getDubbings(userId: string) {
    const userInfo = await this.userModel.findById(userId).populate({
      path: 'dubbings',
      options: {
        sort: { _id: -1 },
      },
      select: 'name created_at url media_key target_languages status',
    });

    return userInfo.toObject().dubbings;
  }

  async addVoice(userId: string, voiceId: ObjectId) {
    await this.userModel.findByIdAndUpdate(userId, {
      $push: { voices: voiceId },
    });
  }

  async addResearch(userId: string, researchId: ObjectId) {
    await this.userModel.findByIdAndUpdate(userId, {
      $push: { researchs: researchId },
    });
  }
}
