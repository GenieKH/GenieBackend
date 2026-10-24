import { IsBoolean, IsOptional } from 'class-validator';

/** `PATCH /notifications/preferences`: only what is sent changes. */
export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  chatMessages?: boolean;

  @IsOptional()
  @IsBoolean()
  promotions?: boolean;

  @IsOptional()
  @IsBoolean()
  savedSearchAlerts?: boolean;
}
