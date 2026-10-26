import { getUserDiscordInfo, isDiscordMember } from './discord';

export type DiscordStatus = 'not_required' | 'sign_in_required' | 'link_required' | 'membership_required' | 'verified' | 'unavailable';

export async function getDiscordStatus(required: boolean, susId?: number): Promise<DiscordStatus> {
  if (!required) return 'not_required';
  if (!susId) return 'sign_in_required';
  try {
    const info = await getUserDiscordInfo(susId);
    if (!info.discordId) return 'link_required';
    return await isDiscordMember(info.discordId) ? 'verified' : 'membership_required';
  } catch (error) {
    console.error('Error verifying registration Discord requirement:', error);
    return 'unavailable';
  }
}

export function registrationEligibility(
  event: { status: string; maxParticipants: number | null },
  count: number, authenticated: boolean, alreadyRegistered: boolean, discordStatus: DiscordStatus,
) {
  const blockedReason = !authenticated ? 'authentication_required'
    : alreadyRegistered ? 'already_registered'
    : event.status !== 'open' ? 'registration_closed'
    : event.maxParticipants != null && count >= event.maxParticipants ? 'event_full'
    : discordStatus === 'link_required' ? 'discord_link_required'
    : discordStatus === 'membership_required' ? 'discord_membership_required'
    : discordStatus === 'unavailable' ? 'discord_verification_unavailable'
    : discordStatus === 'sign_in_required' ? 'authentication_required' : null;
  return {
    canRegister: blockedReason === null, blockedReason, discordStatus,
    requiresDiscordLink: discordStatus === 'link_required',
    requiresDiscordMembership: discordStatus === 'membership_required',
  };
}
