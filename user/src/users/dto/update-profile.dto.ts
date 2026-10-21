import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/** A handle: 3 to 30 lowercase letters, digits, "_" or ".". */
export const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;

/** Seven to twenty characters: digits, with an optional leading "+" and spaces, dots, dashes or brackets between them. */
const PHONE_NUMBER = /^\+?[0-9][0-9 ().-]{5,18}[0-9]$/;

/** The values the `users.sex` column accepts. */
export const SEXES = ['male', 'female', 'other'] as const;
export type Sex = (typeof SEXES)[number];

/** Surrounding spaces never count; an empty text field means "not set". */
function trimToNull({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function toLowerCase({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

/**
 * Every field is optional: only the ones sent are changed. Sending `null`
 * (or an empty string) clears a field, except `username`, which every account keeps.
 * The profile picture has its own endpoints (`AvatarService`).
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Unique handle: 3-30 lowercase letters, digits, "_" or "."',
  })
  @ValidateIf((dto: UpdateProfileDto) => dto.username !== undefined)
  @Transform(toLowerCase)
  @Matches(USERNAME_PATTERN, {
    message:
      'Username must be 3-30 characters: lowercase letters, numbers, "_" or "."',
  })
  username?: string;

  @ApiPropertyOptional({
    description: 'The name shown to other people. Does not have to be unique.',
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(60)
  name?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(50)
  firstName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(50)
  lastName?: string | null;

  @ApiPropertyOptional({ enum: SEXES })
  @IsOptional()
  @IsIn(SEXES)
  sex?: Sex | null;

  @ApiPropertyOptional({ description: 'The new phone number for the user' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(PHONE_NUMBER, {
    message: 'Enter a valid phone number, for example +85512345678',
  })
  phone?: string;
}
