import { ApiProperty } from '@nestjs/swagger'
import { IsIn } from 'class-validator'
import { COMMUNITY_CAMPAIGNS, type CommunityCampaign } from '../../../domain/community'

export class SendCommunityTestDto {
  @ApiProperty({ enum: COMMUNITY_CAMPAIGNS, example: 'christmas' })
  @IsIn(COMMUNITY_CAMPAIGNS)
  campaign: CommunityCampaign
}
