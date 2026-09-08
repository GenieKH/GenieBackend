import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        username: true,
        role: true,
        createdAt: true,
        firebaseUid: true,
      }
    });
    
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, data: { username?: string; phone?: string }) {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          email: true,
          phone: true,
          username: true,
          role: true,
          createdAt: true,
          firebaseUid: true,
        },
      });
      return user;
    } catch (error: any) {
      if (error.code === 'P2002') {
        const target = error.meta?.target;
        if (target && target.includes('phone')) {
          throw new ConflictException('Phone number is already taken');
        }
        throw new ConflictException('Profile update conflict');
      }
      throw error;
    }
  }
}
