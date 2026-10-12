import { IsObject, IsString, MaxLength } from 'class-validator';

export class SaveFirewallRuleDto {
  @IsObject() fields: Record<string, string>;
}
export class MoveFirewallRuleDto {
  @IsString() @MaxLength(32) beforeId: string;
}
