import { IsIn, IsString, IsUUID } from 'class-validator';

export class BeginPublishDto {
  @IsUUID()
  userId!: string;
}

export class SettlePublishDto {
  @IsIn(['Active', 'Draft'])
  outcome!: 'Active' | 'Draft';
}

export class RevertPublishDto {
  @IsString()
  @IsIn(['Draft', 'Expired'])
  status!: string;
}
