import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

/** Profile fields that are safe to return to the client. */
const PROFILE_SELECT = {
  id: true,
  email: true,
  phone: true,
  username: true,
  role: true,
  createdAt: true,
  firebaseUid: true,
  avatarUrl: true,
} as const;

/** What any signed-in user may see about another user. No contact details. */
const PUBLIC_PROFILE_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
  createdAt: true,
} as const;

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PUBLIC_PROFILE_SELECT,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: dto,
        select: PROFILE_SELECT,
      });
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_CONSTRAINT_VIOLATION) {
        throw new ConflictException('Phone number is already taken');
      }
      throw error;
    }
  }
}
