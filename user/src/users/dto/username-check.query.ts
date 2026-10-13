import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

/** `GET /users/username-available?username=`. Any text is allowed: a malformed one is answered, not refused. */
export class UsernameCheckQuery {
  @ApiProperty({ description: 'The username to check' })
  @IsString()
  @MaxLength(100)
  username!: string;
}
