import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl, MaxLength } from 'class-validator';

/** Confirms a picture that was uploaded to the `path` from `POST /users/me/avatar/upload`. */
export class UseAvatarUploadDto {
  @ApiProperty({ description: 'The `path` the upload URL was created for' })
  @IsString()
  @MaxLength(100)
  path!: string;
}

/** "Sync from Google account". */
export class UseGooglePhotoDto {
  @ApiProperty({
    description: "The Google account's photo URL, as Google sign-in reports it",
  })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  photoUrl!: string;
}
